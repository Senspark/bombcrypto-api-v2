import { Transaction } from "ethers";
import { RPC_URLS_GENERAL_USE } from "../lib/rpcManager.js";
import { normalizeNetwork } from "../utils/network.js";
import {
  REQUEST_TIMEOUT_MS,
  getRpcManagerGeneral,
  fetchWithTimeout,
  extractStatusCode,
  withProvider,
} from "../utils/rpc.js";

// Broadcast errors that mean "this exact tx (or its nonce) is already accounted for on-chain".
// The tx hash is deterministic from the signed payload, so we can safely return it as success —
// the caller (ap-deposit-bridge) always re-reads the on-chain counter to decide the real outcome.
const IDEMPOTENT_ERROR_PATTERNS = [
  "already known",
  "already imported",
  "nonce too low",
  "replacement transaction underpriced",
  "transaction underpriced",
];

function isIdempotentError(message) {
  const m = (message || "").toLowerCase();
  return IDEMPOTENT_ERROR_PATTERNS.some((p) => m.includes(p));
}

function validateRequest(body) {
  const { network, signedTx } = body;
  const normalizedNetwork = normalizeNetwork(network);

  if (!normalizedNetwork || !RPC_URLS_GENERAL_USE[normalizedNetwork]) {
    return "Invalid network. Supported: polygon, bsc (or aliases: pol, POL, BSC)";
  }

  if (RPC_URLS_GENERAL_USE[normalizedNetwork].length === 0) {
    return `No RPC URLs configured for network: ${normalizedNetwork}`;
  }

  if (!signedTx || typeof signedTx !== "string" || !signedTx.startsWith("0x")) {
    return "signedTx must be a 0x-prefixed hex string";
  }

  return null;
}

async function executeSendRawTransaction(rpcManager, signedTx, expectedHash) {
  const maxRetries = rpcManager.getRpcCount();
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const rpcUrl = await rpcManager.getNextRpc();

    try {
      const result = await withProvider(rpcUrl, async (provider) => {
        return await fetchWithTimeout(
          provider.broadcastTransaction(signedTx),
          REQUEST_TIMEOUT_MS
        );
      });

      rpcManager.reportSuccess(rpcUrl);
      return { success: true, result: result.hash };
    } catch (error) {
      // Idempotent: the tx (or its nonce) is already known to this node — return the deterministic hash.
      if (isIdempotentError(error.message)) {
        rpcManager.reportSuccess(rpcUrl);
        return { success: true, result: expectedHash };
      }
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

async function handleSendRawTransaction(req, res) {
  const validationError = validateRequest(req.body);
  if (validationError) {
    return res.status(400).json({
      success: false,
      errorString: validationError,
      result: null,
    });
  }

  const { network, signedTx } = req.body;
  const normalizedNetwork = normalizeNetwork(network);

  let expectedHash;
  try {
    expectedHash = Transaction.from(signedTx).hash;
  } catch (error) {
    return res.status(400).json({
      success: false,
      errorString: `invalid signedTx: ${error.message}`,
      result: null,
    });
  }

  try {
    const rpcManager = getRpcManagerGeneral(normalizedNetwork);
    const result = await executeSendRawTransaction(rpcManager, signedTx, expectedHash);

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

export { handleSendRawTransaction };
