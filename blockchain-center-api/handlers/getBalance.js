import { RPC_URLS_GENERAL_USE } from "../lib/rpcManager.js";
import { normalizeNetwork } from "../utils/network.js";
import {
  REQUEST_TIMEOUT_MS,
  getRpcManagerGeneral,
  fetchWithTimeout,
  extractStatusCode,
  withProvider,
} from "../utils/rpc.js";

function validateRequest(body) {
  const { network, address } = body;
  const normalizedNetwork = normalizeNetwork(network);

  if (!normalizedNetwork || !RPC_URLS_GENERAL_USE[normalizedNetwork]) {
    return "Invalid network. Supported: polygon, bsc (or aliases: pol, POL, BSC)";
  }

  if (RPC_URLS_GENERAL_USE[normalizedNetwork].length === 0) {
    return `No RPC URLs configured for network: ${normalizedNetwork}`;
  }

  if (!address || typeof address !== "string" || !address.startsWith("0x") || address.length !== 42) {
    return "address must be a 42-char 0x-prefixed address";
  }

  return null;
}

async function executeGetBalance(rpcManager, address) {
  const maxRetries = rpcManager.getRpcCount();
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const rpcUrl = await rpcManager.getNextRpc();

    try {
      const balance = await withProvider(rpcUrl, async (provider) => {
        return await fetchWithTimeout(provider.getBalance(address), REQUEST_TIMEOUT_MS);
      });

      rpcManager.reportSuccess(rpcUrl);
      return { success: true, result: balance.toString() };
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

async function handleGetBalance(req, res) {
  const validationError = validateRequest(req.body);
  if (validationError) {
    return res.status(400).json({
      success: false,
      errorString: validationError,
      result: null,
    });
  }

  const { network, address } = req.body;
  const normalizedNetwork = normalizeNetwork(network);

  try {
    const rpcManager = getRpcManagerGeneral(normalizedNetwork);
    const result = await executeGetBalance(rpcManager, address);

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

export { handleGetBalance };
