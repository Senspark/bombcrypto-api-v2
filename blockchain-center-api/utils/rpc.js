import { JsonRpcProvider, FetchRequest } from "ethers";
import { RpcManager, RPC_URLS_SUPPORT_GET_LOGS, RPC_URLS_GENERAL_USE } from "../lib/rpcManager.js";
import { BlockNumberManager } from "../lib/blockNumberManager.js";
import { nextEgress } from "../lib/egress.js";

const REQUEST_TIMEOUT_MS = 20000;

// Cache RpcManagers per network - separate for getLogs vs general use
const rpcManagersForLogs = {};
const rpcManagersGeneral = {};

// Cache BlockNumberManagers per network
const blockNumberManagers = {};

function getRpcManagerForLogs(network) {
  if (!rpcManagersForLogs[network]) {
    // getLogs manager - no fallback (general doesn't support getLogs)
    rpcManagersForLogs[network] = new RpcManager(network, RPC_URLS_SUPPORT_GET_LOGS);
  }
  return rpcManagersForLogs[network];
}

function getRpcManagerGeneral(network) {
  if (!rpcManagersGeneral[network]) {
    // General manager with getLogs URLs as fallback
    rpcManagersGeneral[network] = new RpcManager(
      network,
      RPC_URLS_GENERAL_USE,
      RPC_URLS_SUPPORT_GET_LOGS
    );
  }
  return rpcManagersGeneral[network];
}

function getBlockNumberManager(network) {
  if (!blockNumberManagers[network]) {
    const rpcManager = getRpcManagerGeneral(network);
    blockNumberManagers[network] = new BlockNumberManager(network, rpcManager);
  }
  return blockNumberManagers[network];
}

async function fetchWithTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs)
    ),
  ]);
}

async function withProvider(rpcUrl, callback) {
  // Pick an egress (proxy) per call and route the provider's HTTP through it.
  // Without proxies configured, egress.agent is null => direct connection.
  const egress = nextEgress();
  let provider;
  if (egress.agent) {
    const req = new FetchRequest(rpcUrl);
    req.getUrlFunc = FetchRequest.createGetUrlFunc({ agent: egress.agent });
    provider = new JsonRpcProvider(req);
  } else {
    provider = new JsonRpcProvider(rpcUrl);
  }
  try {
    return await callback(provider);
  } finally {
    provider.destroy();
  }
}

function extractStatusCode(error) {
  // ethers.js wraps HTTP errors; try to extract status code
  if (error.status) return error.status;
  if (error.error?.status) return error.error.status;
  if (error.info?.error?.status) return error.info.error.status;

  // Check error message for common patterns
  const message = error.message || "";
  if (message.includes("429") || message.toLowerCase().includes("limit")) {
    return 429;
  }
  if (message.includes("timeout")) {
    return 504;
  }
  if (message.includes("500") || message.includes("502") || message.includes("503")) {
    return 500;
  }

  return 0; // Unknown
}

// Networks with at least one configured RPC. Populated by buildAllManagers()
// after the RPC config has been loaded (from Redis or the config file).
const allNetworks = new Set();

// Build managers for every configured network so /web shows RPCs immediately.
// Called once at startup, after initRpcConfig().
function buildAllManagers() {
  allNetworks.clear();
  for (const network of Object.keys(RPC_URLS_SUPPORT_GET_LOGS)) allNetworks.add(network);
  for (const network of Object.keys(RPC_URLS_GENERAL_USE)) allNetworks.add(network);
  for (const network of allNetworks) {
    getRpcManagerForLogs(network);
    getRpcManagerGeneral(network);
  }
}

export {
  REQUEST_TIMEOUT_MS,
  allNetworks,
  buildAllManagers,
  rpcManagersForLogs,
  rpcManagersGeneral,
  getRpcManagerForLogs,
  getRpcManagerGeneral,
  getBlockNumberManager,
  fetchWithTimeout,
  extractStatusCode,
  withProvider,
};
