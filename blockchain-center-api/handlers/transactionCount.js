import { RPC_URLS_GENERAL_USE } from "../lib/rpcManager.js";
import { normalizeNetwork } from "../utils/network.js";
import {
  REQUEST_TIMEOUT_MS,
  getRpcManagerGeneral,
  fetchWithTimeout,
  extractStatusCode,
  withProvider,
} from "../utils/rpc.js";

function validateAddress(address) {
  if (!address || typeof address !== "string") {
    return "address is required";
  }
  if (!address.startsWith("0x")) {
    return "address must be 0x-prefixed";
  }
  if (address.length !== 42) {
    return "address must be 42 characters (0x + 40 hex chars)";
  }
  return null;
}

function validateRequest(body) {
  const { network, address, blockTag } = body;
  const normalizedNetwork = normalizeNetwork(network);

  if (!normalizedNetwork || !RPC_URLS_GENERAL_USE[normalizedNetwork]) {
    return "Invalid network. Supported: polygon, bsc (or aliases: pol, POL, BSC)";
  }

  if (RPC_URLS_GENERAL_USE[normalizedNetwork].length === 0) {
    return `No RPC URLs configured for network: ${normalizedNetwork}`;
  }

  const addressError = validateAddress(address);
  if (addressError) {
    return addressError;
  }

  if (blockTag !== undefined && blockTag !== "latest" && blockTag !== "pending") {
    return "blockTag must be 'latest' or 'pending'";
  }

  return null;
}

async function executeGetTransactionCount(rpcManager, address, blockTag) {
  const maxRetries = rpcManager.getRpcCount();
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const rpcUrl = await rpcManager.getNextRpc();

    try {
      const result = await withProvider(rpcUrl, async (provider) => {
        return await fetchWithTimeout(
          provider.getTransactionCount(address, blockTag),
          REQUEST_TIMEOUT_MS
        );
      });

      rpcManager.reportSuccess(rpcUrl);
      return { success: true, result: Number(result) };
    } catch (error) {
      lastError = error;
      const statusCode = extractStatusCode(error);
      console.log(`RPC ${rpcUrl} failed: ${error.message} (status: ${statusCode})`);
      rpcManager.reportError(rpcUrl, statusCode);
    }
  }

  return {
    success: false,
    error: lastError?.message || "All RPCs exhausted",
  };
}

async function handleGetTransactionCount(req, res) {
  const validationError = validateRequest(req.body);
  if (validationError) {
    return res.status(400).json({
      success: false,
      errorString: validationError,
      result: null,
    });
  }

  const { network, address, blockTag } = req.body;
  const normalizedNetwork = normalizeNetwork(network);

  try {
    const rpcManager = getRpcManagerGeneral(normalizedNetwork);
    const result = await executeGetTransactionCount(rpcManager, address, blockTag ?? "latest");

    if (result.success) {
      return res.json({
        success: true,
        errorString: "",
        result: result.result,
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

export { handleGetTransactionCount };
