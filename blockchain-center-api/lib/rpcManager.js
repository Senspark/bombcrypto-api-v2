import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { analytics } from "./analytics.js";
import { getRedis, isRedisConnected } from "./redisClient.js";
import { RedisKeys } from "../consts/redisKeys.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, "..", "rpc.config.json");

// Effective RPC lists (mutable at runtime). Populated by initRpcConfig().
// Exported as live bindings so handlers/managers see add/remove changes.
let RPC_URLS_SUPPORT_GET_LOGS = {};
let RPC_URLS_GENERAL_USE = {};

// Central RPC state store (by URL) - state is tied to URL, not manager
const rpcStates = new Map();

function loadConfigFromFile() {
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    console.error(`Failed to load RPC config from ${configPath}`);
    console.error("Copy rpc.config.example.json to rpc.config.json and configure your RPC URLs.");
    process.exit(1);
  }
}

// Shuffle each network's RPC list so multiple server instances (or restarts)
// don't all hit the same endpoints in the same order.
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shuffleRpcConfig(cfg) {
  for (const group of Object.values(cfg)) {
    if (!group || typeof group !== "object") continue;
    for (const key of Object.keys(group)) {
      if (Array.isArray(group[key])) shuffleInPlace(group[key]);
    }
  }
}

// Redis is the source of truth: seed from the config file only on first boot
// (when the list key is absent), then the stored list wins. If Redis is
// unavailable, fall back to the config file for this process lifetime.
async function initRpcConfig() {
  const redis = getRedis();
  let list = null;

  if (redis && isRedisConnected()) {
    try {
      const raw = await redis.get(RedisKeys.RPC_LIST);
      if (raw) list = JSON.parse(raw);
    } catch (e) {
      console.warn(`Failed to load RPC list from Redis: ${e.message}. Falling back to config file.`);
    }
  }

  let seeded = false;
  if (!list) {
    list = loadConfigFromFile();
    seeded = true;
  }

  RPC_URLS_SUPPORT_GET_LOGS = list.getLogs || {};
  RPC_URLS_GENERAL_USE = list.general || {};
  shuffleRpcConfig({ getLogs: RPC_URLS_SUPPORT_GET_LOGS, general: RPC_URLS_GENERAL_USE });

  if (seeded) {
    console.log("RPC list seeded from config file");
    await persistList();
  } else {
    console.log("RPC list loaded from Redis");
  }

  // Restore pause state
  if (redis && isRedisConnected()) {
    try {
      const paused = await redis.sMembers(RedisKeys.RPC_PAUSED);
      for (const url of paused) getRpcState(url).paused = true;
      if (paused.length) console.log(`Restored ${paused.length} paused RPC(s) from Redis`);
    } catch (e) {
      console.warn(`Failed to load paused RPCs from Redis: ${e.message}`);
    }
  }
}

async function persistList() {
  const redis = getRedis();
  if (!redis || !isRedisConnected()) {
    console.warn("Redis unavailable; RPC list change not persisted");
    return false;
  }
  try {
    await redis.set(
      RedisKeys.RPC_LIST,
      JSON.stringify({ getLogs: RPC_URLS_SUPPORT_GET_LOGS, general: RPC_URLS_GENERAL_USE })
    );
    return true;
  } catch (e) {
    console.warn(`Failed to persist RPC list to Redis: ${e.message}`);
    return false;
  }
}

async function persistPaused(url, paused) {
  const redis = getRedis();
  if (!redis || !isRedisConnected()) {
    console.warn("Redis unavailable; pause state not persisted");
    return false;
  }
  try {
    if (paused) await redis.sAdd(RedisKeys.RPC_PAUSED, url);
    else await redis.sRem(RedisKeys.RPC_PAUSED, url);
    return true;
  } catch (e) {
    console.warn(`Failed to persist pause state to Redis: ${e.message}`);
    return false;
  }
}

function getListFor(type) {
  if (type === "getLogs") return RPC_URLS_SUPPORT_GET_LOGS;
  if (type === "general") return RPC_URLS_GENERAL_USE;
  return null;
}

function urlExistsAnywhere(url) {
  for (const group of [RPC_URLS_SUPPORT_GET_LOGS, RPC_URLS_GENERAL_USE]) {
    for (const arr of Object.values(group)) {
      if (Array.isArray(arr) && arr.includes(url)) return true;
    }
  }
  return false;
}

function getRpcState(url) {
  if (!rpcStates.has(url)) {
    rpcStates.set(url, { readyAt: 0, inFlight: false, paused: false });
  }
  return rpcStates.get(url);
}

async function toggleRpcPause(url) {
  const state = getRpcState(url);
  state.paused = !state.paused;
  if (!state.paused) {
    state.readyAt = 0; // Make immediately available on resume
    analytics.resetRpc(url); // Clear counters so the resumed RPC is easy to watch
  }
  console.log(`RPC ${state.paused ? "paused" : "resumed"}: ${url}`);
  await persistPaused(url, state.paused);
  return state.paused;
}

// Add an RPC to the in-memory list (mutated in place so live managers pick it
// up) and persist the new list. Returns { added, reason? }.
async function addRpc(type, network, url) {
  const group = getListFor(type);
  if (!group) return { added: false, reason: "invalid type" };
  if (!group[network]) group[network] = [];
  if (group[network].includes(url)) return { added: false, reason: "already exists" };

  group[network].push(url);
  console.log(`RPC added [${type}/${network}]: ${url}`);
  await persistList();
  return { added: true };
}

async function removeRpc(type, network, url) {
  const group = getListFor(type);
  if (!group) return { removed: false, reason: "invalid type" };
  const arr = group[network];
  if (!Array.isArray(arr)) return { removed: false, reason: "not found" };
  const idx = arr.indexOf(url);
  if (idx === -1) return { removed: false, reason: "not found" };

  arr.splice(idx, 1);
  console.log(`RPC removed [${type}/${network}]: ${url}`);
  await persistList();

  // Only clear per-URL state once the URL is gone from every list (it may still
  // live in the other type's list).
  if (!urlExistsAnywhere(url)) {
    rpcStates.delete(url);
    analytics.removeRpc(url);
    await persistPaused(url, false);
  }
  return { removed: true };
}

const COOLDOWN_MS = {
  default: 1000,
  rateLimit: 60000,
  serverError: 10000,
};

class RpcManager {
  constructor(network, rpcUrls, fallbackUrls = null) {
    this.urls = rpcUrls[network] || [];
    this.fallbackUrls = fallbackUrls ? (fallbackUrls[network] || []) : [];
    this.currentIndex = 0;
    this.fallbackIndex = 0;

    if (this.urls.length === 0) {
      throw new Error(`No RPC URLs configured for network: ${network}`);
    }
  }

  async getNextRpc() {
    // Try primary URLs
    const primaryUrl = this._findReadyUrl(this.urls, "currentIndex");
    if (primaryUrl) return primaryUrl;

    // Try fallback URLs
    if (this.fallbackUrls.length > 0) {
      const fallbackUrl = this._findReadyUrl(this.fallbackUrls, "fallbackIndex");
      if (fallbackUrl) {
        console.log(`Using fallback RPC: ${fallbackUrl}`);
        return fallbackUrl;
      }
    }

    // Neither ready - wait for soonest
    return this._waitForReady();
  }

  _findReadyUrl(urls, indexKey) {
    const now = Date.now();
    const startIndex = this[indexKey];

    for (let i = 0; i < urls.length; i++) {
      const index = (startIndex + i) % urls.length;
      const url = urls[index];
      const state = getRpcState(url);

      if (state.readyAt <= now && !state.inFlight && !state.paused) {
        state.inFlight = true;
        analytics.recordRpcCall(url);
        this[indexKey] = (index + 1) % urls.length;
        return url;
      }
    }
    return null;
  }

  async _waitForReady() {
    const allUrls = [...this.urls, ...this.fallbackUrls];
    const now = Date.now();

    // Find soonest ready URL that's not in flight
    const available = allUrls
      .map((url) => ({ url, state: getRpcState(url) }))
      .filter(({ state }) => !state.inFlight && !state.paused);

    if (available.length === 0) {
      console.log("All RPCs in flight. Waiting...");
      await this.sleep(100);
      return this.getNextRpc();
    }

    const soonest = available.reduce((min, curr) =>
      curr.state.readyAt < min.state.readyAt ? curr : min
    );

    const waitTime = Math.max(0, soonest.state.readyAt - now);
    if (waitTime > 0) {
      console.log(`All RPCs on cooldown. Waiting ${waitTime}ms for ${soonest.url}`);
      analytics.recordCooldownWait();
      await this.sleep(waitTime);
    }

    soonest.state.inFlight = true;
    analytics.recordRpcCall(soonest.url);
    return soonest.url;
  }

  reportSuccess(url) {
    const state = getRpcState(url);
    state.inFlight = false;
    state.readyAt = Date.now() + COOLDOWN_MS.default;
    analytics.recordSuccess(url);
  }

  reportError(url, statusCode) {
    const state = getRpcState(url);
    state.inFlight = false;
    analytics.recordFailure(url);

    const now = Date.now();

    if (statusCode === 429) {
      state.readyAt = now + COOLDOWN_MS.rateLimit;
      console.log(`RPC ${url} rate limited. Cooldown: 60s`);
    } else if (statusCode >= 500) {
      state.readyAt = now + COOLDOWN_MS.serverError;
      console.log(`RPC ${url} server error (${statusCode}). Cooldown: 10s`);
    } else if (statusCode >= 400) {
      console.log(`RPC ${url} client error (${statusCode}). Skipping to next.`);
    }
  }

  // These methods only return primary URLs to avoid duplicates in monitor
  // (fallback URLs are already shown by the getLogs manager)
  getRpcCount() {
    return this.urls.length;
  }

  getStatus() {
    const now = Date.now();
    return this.urls.map((url) => {
      const state = getRpcState(url);
      return {
        url,
        readyAt: state.readyAt,
        inFlight: state.inFlight,
        paused: state.paused,
        ready: state.readyAt <= now && !state.inFlight && !state.paused,
      };
    });
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export {
  RpcManager,
  RPC_URLS_SUPPORT_GET_LOGS,
  RPC_URLS_GENERAL_USE,
  initRpcConfig,
  toggleRpcPause,
  addRpc,
  removeRpc,
};
