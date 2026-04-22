import { Contract, Interface } from "ethers";
import { RPC_URLS_GENERAL_USE } from "../lib/rpcManager.js";
import { normalizeNetwork } from "../utils/network.js";
import {
  REQUEST_TIMEOUT_MS,
  getRpcManagerGeneral,
  fetchWithTimeout,
  extractStatusCode,
  withProvider,
} from "../utils/rpc.js";

const MULTICALL3_ADDRESS = "0xca11bde05977b3631167028862be2a173976ca11";
const MULTICALL3_ABI = [
  "function tryAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) public payable returns (tuple(bool success, bytes returnData)[])",
  "function getEthBalance(address addr) public view returns (uint256 balance)"
];

// Cache Interfaces per ABI to avoid expensive re-parsing
const interfaceCache = new Map();

function getInterface(abi) {
  const abiKey = typeof abi === "string" ? abi : JSON.stringify(abi);
  if (!interfaceCache.has(abiKey)) {
    interfaceCache.set(abiKey, new Interface(abi));
  }
  return interfaceCache.get(abiKey);
}

const multicallInterface = getInterface(MULTICALL3_ABI);

function serializeResult(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeResult);
  }
  if (typeof value === "object" && value !== null) {
      // Handle ethers Result objects which have numeric and named keys
      const obj = {};
      for (const key of Object.keys(value)) {
          if (isNaN(Number(key))) { // Skip numeric keys
              obj[key] = serializeResult(value[key]);
          }
      }
      return Object.keys(obj).length > 0 ? obj : value.toString();
  }
  return value;
}

async function executeMulticall(rpcManager, calls) {
  const maxRetries = rpcManager.getRpcCount();
  let lastError = null;

  // Prepare calls for Multicall3
  const formattedCalls = calls.map(call => {
    const iface = getInterface(call.abi);
    return {
      target: call.contractAddress,
      callData: iface.encodeFunctionData(call.methodName, call.args || [])
    };
  });

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const rpcUrl = await rpcManager.getNextRpc();

    try {
      const result = await withProvider(rpcUrl, async (provider) => {
        const multicallContract = new Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
        const returnData = await fetchWithTimeout(
          multicallContract.tryAggregate(false, formattedCalls),
          REQUEST_TIMEOUT_MS
        );
        
        // Decode results array
        return returnData.map((item, index) => {
          const call = calls[index];
          if (!item.success) {
            return { success: false, error: "Call failed", result: null };
          }
          try {
            const iface = getInterface(call.abi);
            const decoded = iface.decodeFunctionResult(call.methodName, item.returnData);
            return {
              success: true,
              result: serializeResult(decoded.length === 1 ? decoded[0] : decoded)
            };
          } catch (decodeError) {
            return { success: false, error: decodeError.message, result: null };
          }
        });
      });

      rpcManager.reportSuccess(rpcUrl);
      return { success: true, results: result };
    } catch (error) {
      lastError = error;
      const statusCode = extractStatusCode(error);
      console.log(`RPC ${rpcUrl} failed during multicall: ${error.message} (status: ${statusCode})`);
      rpcManager.reportError(rpcUrl, statusCode);
    }
  }

  return {
    success: false,
    error: lastError?.message || "All RPCs exhausted",
  };
}

async function handleMulticall(req, res) {
  const { network, calls } = req.body;
  const normalizedNetwork = normalizeNetwork(network);

  if (!normalizedNetwork || !RPC_URLS_GENERAL_USE[normalizedNetwork]) {
    return res.status(400).json({
      success: false,
      errorString: "Invalid network",
      results: null,
    });
  }

  if (!Array.isArray(calls) || calls.length === 0) {
    return res.status(400).json({
      success: false,
      errorString: "calls must be a non-empty array",
      results: null,
    });
  }

  try {
    const rpcManager = getRpcManagerGeneral(normalizedNetwork);
    const result = await executeMulticall(rpcManager, calls);

    if (result.success) {
      return res.json({
        success: true,
        errorString: "",
        results: result.results,
      });
    } else {
      return res.status(400).json({
        success: false,
        errorString: result.error,
        results: null,
      });
    }
  } catch (error) {
    console.error("Multicall unexpected error:", error);
    return res.status(500).json({
      success: false,
      errorString: error.message,
      results: null,
    });
  }
}

export { handleMulticall };
