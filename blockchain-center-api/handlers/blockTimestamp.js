import { RPC_URLS_GENERAL_USE } from "../lib/rpcManager.js";
import { normalizeNetwork } from "../utils/network.js";
import {
  REQUEST_TIMEOUT_MS,
  getRpcManagerGeneral,
  fetchWithTimeout,
  extractStatusCode,
  withProvider,
} from "../utils/rpc.js";

function validateBlockTimestampRequest(body) {
  const { network, blockNumber } = body;
  const normalizedNetwork = normalizeNetwork(network);

  if (!normalizedNetwork || !RPC_URLS_GENERAL_USE[normalizedNetwork]) {
    return "Invalid network. Supported: polygon, bsc (or aliases: pol, POL, BSC)";
  }

  if (RPC_URLS_GENERAL_USE[normalizedNetwork].length === 0) {
    return `No RPC URLs configured for network: ${normalizedNetwork}`;
  }

  if (typeof blockNumber !== "number" || blockNumber < 0 || !Number.isInteger(blockNumber)) {
    return "blockNumber must be a non-negative integer";
  }

  return null;
}

const timestampCache = new Map();

function getTimestampKey(network, blockNumber) {
  return `${network}:${blockNumber}`;
}

async function executeGetBlockTimestamp(rpcManager, blockNumber, normalizedNetwork) {
  const cacheKey = getTimestampKey(normalizedNetwork, blockNumber);
  if (timestampCache.has(cacheKey)) {
    return { success: true, timestamp: timestampCache.get(cacheKey) };
  }

  const maxRetries = rpcManager.getRpcCount();
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const rpcUrl = await rpcManager.getNextRpc();

    try {
      const block = await withProvider(rpcUrl, async (provider) => {
        return await fetchWithTimeout(
          provider.getBlock(blockNumber),
          REQUEST_TIMEOUT_MS
        );
      });

      if (!block) {
        throw new Error(`Block ${blockNumber} not found`);
      }

      rpcManager.reportSuccess(rpcUrl);
      timestampCache.set(cacheKey, block.timestamp);
      
      // Limit cache size to prevent memory leaks (keep last 5000 blocks)
      if (timestampCache.size > 5000) {
          const firstKey = timestampCache.keys().next().value;
          timestampCache.delete(firstKey);
      }

      return { success: true, timestamp: block.timestamp };
    } catch (error) {
      lastError = error;
      const statusCode = extractStatusCode(error);
      console.log(`RPC ${rpcUrl} failed: ${error.message} (status: ${statusCode})`);
      rpcManager.reportError(rpcUrl, statusCode);
    }
  }

  return { success: false, error: lastError?.message || "All RPCs exhausted" };
}

async function handleGetBlockTimestamp(req, res) {
  const validationError = validateBlockTimestampRequest(req.body);
  if (validationError) {
    return res.status(400).json({
      success: false,
      errorString: validationError,
      result: null,
    });
  }

  const { network, blockNumber } = req.body;
  const normalizedNetwork = normalizeNetwork(network);

  try {
    const rpcManager = getRpcManagerGeneral(normalizedNetwork);
    const result = await executeGetBlockTimestamp(rpcManager, blockNumber, normalizedNetwork);

    if (result.success) {
      return res.json({
        success: true,
        errorString: "",
        result: result.timestamp,
      });
    } else {
      return res.status(400).json({
        success: false,
        errorString: result.error,
        result: null,
      });
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({
      success: false,
      errorString: error.message,
      result: null,
    });
  }
}

export { handleGetBlockTimestamp };
