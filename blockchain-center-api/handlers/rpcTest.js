import { JsonRpcProvider } from "ethers";
import { REQUEST_TIMEOUT_MS, fetchWithTimeout } from "../utils/rpc.js";

// Address that emits no logs, so the getLogs probe stays small and fast while
// still exercising eth_getLogs (an RPC without getLogs support errors instead).
const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000";
const GET_LOGS_WINDOW = 5; // blocks

// Probe a single RPC URL ad-hoc (no rotation pool, no cooldown/analytics impact)
// for general use (eth_chainId + eth_blockNumber) and getLogs support.
async function handleRpcTest(req, res) {
  const { url } = req.body;
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    return res.status(400).json({ error: "url is required (http/https)" });
  }

  const result = { url, general: {}, getLogs: {} };
  const provider = new JsonRpcProvider(url);

  try {
    // General use: chain identity + latest block
    try {
      const t0 = Date.now();
      const network = await fetchWithTimeout(provider.getNetwork(), REQUEST_TIMEOUT_MS);
      const blockNumber = await fetchWithTimeout(provider.getBlockNumber(), REQUEST_TIMEOUT_MS);
      result.general = {
        ok: true,
        chainId: Number(network.chainId),
        blockNumber,
        latencyMs: Date.now() - t0,
      };
    } catch (e) {
      result.general = { ok: false, error: e.message };
    }

    // getLogs support
    try {
      const t0 = Date.now();
      const latest = await fetchWithTimeout(provider.getBlockNumber(), REQUEST_TIMEOUT_MS);
      const fromBlock = Math.max(0, latest - GET_LOGS_WINDOW);
      const logs = await fetchWithTimeout(
        provider.getLogs({ address: EMPTY_ADDRESS, fromBlock, toBlock: latest }),
        REQUEST_TIMEOUT_MS
      );
      result.getLogs = {
        ok: true,
        count: logs.length,
        range: `${fromBlock}-${latest}`,
        latencyMs: Date.now() - t0,
      };
    } catch (e) {
      result.getLogs = { ok: false, error: e.message };
    }
  } finally {
    provider.destroy();
  }

  return res.json(result);
}

export { handleRpcTest };
