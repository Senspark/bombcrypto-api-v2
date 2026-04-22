import { normalizeNetwork } from "../utils/network.js";
import { RPC_URLS_GENERAL_USE } from "../lib/rpcManager.js";
import { getRpcManagerGeneral, withProvider } from "../utils/rpc.js";
import { feeSuggester } from "../lib/feeSuggester.js";

async function handleSuggestFee(req, res) {
  const network = req.query.network || req.body.network;
  const normalizedNetwork = normalizeNetwork(network);

  if (!normalizedNetwork || !RPC_URLS_GENERAL_USE[normalizedNetwork]) {
    return res.status(400).json({
      success: false,
      errorString: "Invalid network",
      suggestion: null,
    });
  }

  try {
    const rpcManager = getRpcManagerGeneral(normalizedNetwork);
    const rpcUrl = await rpcManager.getNextRpc();

    const suggestion = await withProvider(rpcUrl, async (provider) => {
      return await feeSuggester.suggest(normalizedNetwork, provider);
    });

    rpcManager.reportSuccess(rpcUrl);

    return res.json({
      success: true,
      errorString: "",
      suggestion: suggestion,
    });
  } catch (error) {
    console.error("Fee suggestion error:", error);
    return res.status(500).json({
      success: false,
      errorString: error.message,
      suggestion: null,
    });
  }
}

export { handleSuggestFee };
