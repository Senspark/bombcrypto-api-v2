import { JsonRpcProvider } from "ethers";
import { RpcManager, RPC_URLS_SUPPORT_GET_LOGS, RPC_URLS_GENERAL_USE } from "../lib/rpcManager.js";
import { BlockNumberManager } from "../lib/blockNumberManager.js";
import { providerPool } from "../lib/providerPool.js";

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
  const provider = providerPool.getProvider(rpcUrl);
  try {
    return await callback(provider);
  } catch (error) {
    // If we hit a severe connection issue, clear the provider from the pool
    const statusCode = extractStatusCode(error);
    if (statusCode === 500 || statusCode === 0) {
      providerPool.deleteProvider(rpcUrl);
    }
    throw error;
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

// Initialize managers for all networks at module load (so /web shows RPCs immediately)
const allNetworks = new Set([
  ...Object.keys(RPC_URLS_SUPPORT_GET_LOGS),
  ...Object.keys(RPC_URLS_GENERAL_USE),
]);
for (const network of allNetworks) {
  getRpcManagerForLogs(network);
  getRpcManagerGeneral(network);
}

export {
  REQUEST_TIMEOUT_MS,
  allNetworks,
  rpcManagersForLogs,
  rpcManagersGeneral,
  getRpcManagerForLogs,
  getRpcManagerGeneral,
  getBlockNumberManager,
  fetchWithTimeout,
  extractStatusCode,
  withProvider,
};
