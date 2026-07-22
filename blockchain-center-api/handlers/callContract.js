import { Contract } from "ethers";
import { RPC_URLS_GENERAL_USE } from "../lib/rpcManager.js";
import { normalizeNetwork } from "../utils/network.js";
import {
  REQUEST_TIMEOUT_MS,
  getRpcManagerGeneral,
  fetchWithTimeout,
  extractStatusCode,
  withProvider,
} from "../utils/rpc.js";

function serializeResult(value) {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeResult);
  }
  return value;
}

function validateContractAddress(contractAddress) {
  if (!contractAddress || typeof contractAddress !== "string") {
    return "contractAddress is required";
  }
  if (!contractAddress.startsWith("0x")) {
    return "contractAddress must be 0x-prefixed";
  }
  if (contractAddress.length !== 42) {
    return "contractAddress must be 42 characters (0x + 40 hex chars)";
  }
  return null;
}

function validateCallContractRequest(body) {
  const { network, contractAddress, abi, methodName, args, confirmations } = body;
  const normalizedNetwork = normalizeNetwork(network);

  if (!normalizedNetwork || !RPC_URLS_GENERAL_USE[normalizedNetwork]) {
    return "Invalid network. Supported: polygon, bsc (or aliases: pol, POL, BSC)";
  }

  if (RPC_URLS_GENERAL_USE[normalizedNetwork].length === 0) {
    return `No RPC URLs configured for network: ${normalizedNetwork}`;
  }

  const addressError = validateContractAddress(contractAddress);
  if (addressError) {
    return addressError;
  }

  if (!abi || !Array.isArray(abi) || abi.length === 0) {
    return "abi must be a non-empty array";
  }

  if (!methodName || typeof methodName !== "string") {
    return "methodName must be a non-empty string";
  }

  if (!Array.isArray(args)) {
    return "args must be an array (can be empty)";
  }

  if (confirmations !== undefined && (!Number.isInteger(confirmations) || confirmations < 0)) {
    return "confirmations must be an integer >= 0";
  }

  return null;
}

// `confirmations` (approach B — reorg-safe reads): read at a fixed depth behind the tip so a read
// can't land on a block that later reorgs out. The gateway computes blockTag = latest - confirmations
// itself (full nodes retain ~128 recent blocks, so no archive node needed). 0/undefined = read latest.
async function executeContractCall(rpcManager, contractAddress, abi, methodName, args, confirmations) {
  const maxRetries = rpcManager.getRpcCount();
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const rpcUrl = await rpcManager.getNextRpc();
    // console.log(`Attempt ${attempt + 1}/${maxRetries}: Using RPC ${rpcUrl}`);

    try {
      const result = await withProvider(rpcUrl, async (provider) => {
        const contract = new Contract(contractAddress, abi, provider);
        const callArgs = [...args];
        if (confirmations > 0) {
          const latest = await fetchWithTimeout(provider.getBlockNumber(), REQUEST_TIMEOUT_MS);
          const blockTag = Math.max(0, latest - confirmations);
          callArgs.push({ blockTag });
        }
        return await fetchWithTimeout(
          contract[methodName](...callArgs),
          REQUEST_TIMEOUT_MS
        );
      });

      rpcManager.reportSuccess(rpcUrl);
      return { success: true, result: serializeResult(result) };
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

async function handleCallContract(req, res) {
  const validationError = validateCallContractRequest(req.body);
  if (validationError) {
    return res.status(400).json({
      success: false,
      errorString: validationError,
      result: null,
    });
  }

  const { network, contractAddress, abi, methodName, args, confirmations } = req.body;
  const normalizedNetwork = normalizeNetwork(network);

  try {
    const rpcManager = getRpcManagerGeneral(normalizedNetwork);
    const result = await executeContractCall(
      rpcManager,
      contractAddress,
      abi,
      methodName,
      args,
      confirmations ?? 0
    );

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

export { handleCallContract };
