import { RPC_URLS_GENERAL_USE } from "../lib/rpcManager.js";
import { normalizeNetwork } from "../utils/network.js";
import {
  REQUEST_TIMEOUT_MS,
  getRpcManagerGeneral,
  fetchWithTimeout,
  extractStatusCode,
  withProvider,
} from "../utils/rpc.js";

function validateAddress(label, address) {
  if (!address || typeof address !== "string") {
    return `${label} is required`;
  }
  if (!address.startsWith("0x") || address.length !== 42) {
    return `${label} must be a 42-char 0x-prefixed address`;
  }
  return null;
}

function validateRequest(body) {
  const { network, from, to, data } = body;
  const normalizedNetwork = normalizeNetwork(network);

  if (!normalizedNetwork || !RPC_URLS_GENERAL_USE[normalizedNetwork]) {
    return "Invalid network. Supported: polygon, bsc (or aliases: pol, POL, BSC)";
  }

  if (RPC_URLS_GENERAL_USE[normalizedNetwork].length === 0) {
    return `No RPC URLs configured for network: ${normalizedNetwork}`;
  }

  const fromError = validateAddress("from", from);
  if (fromError) return fromError;

  const toError = validateAddress("to", to);
  if (toError) return toError;

  if (data !== undefined && (typeof data !== "string" || !data.startsWith("0x"))) {
    return "data must be a 0x-prefixed hex string";
  }

  return null;
}

async function executeEstimateGas(rpcManager, tx) {
  const maxRetries = rpcManager.getRpcCount();
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const rpcUrl = await rpcManager.getNextRpc();

    try {
      const gas = await withProvider(rpcUrl, async (provider) => {
        return await fetchWithTimeout(provider.estimateGas(tx), REQUEST_TIMEOUT_MS);
      });

      rpcManager.reportSuccess(rpcUrl);
      return { success: true, result: gas.toString() };
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

async function handleEstimateGas(req, res) {
  const validationError = validateRequest(req.body);
  if (validationError) {
    return res.status(400).json({
      success: false,
      errorString: validationError,
      result: null,
    });
  }

  const { network, from, to, data, value } = req.body;
  const normalizedNetwork = normalizeNetwork(network);

  const tx = { from, to };
  if (data !== undefined) tx.data = data;
  if (value !== undefined) tx.value = value;

  try {
    const rpcManager = getRpcManagerGeneral(normalizedNetwork);
    const result = await executeEstimateGas(rpcManager, tx);

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

export { handleEstimateGas };
