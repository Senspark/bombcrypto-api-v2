import { addRpc, removeRpc } from "../lib/rpcManager.js";
import { normalizeNetwork } from "../utils/network.js";

const VALID_TYPES = ["getLogs", "general"];

function validate({ type, network, url }) {
  if (!VALID_TYPES.includes(type)) {
    return "type must be 'getLogs' or 'general'";
  }
  if (!normalizeNetwork(network)) {
    return "Invalid network. Supported: polygon, bsc (or aliases: pol, POL, BSC)";
  }
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    return "url is required (http/https)";
  }
  return null;
}

async function handleAddRpc(req, res) {
  const error = validate(req.body);
  if (error) return res.status(400).json({ success: false, error });

  const { type, url } = req.body;
  const network = normalizeNetwork(req.body.network);
  const result = await addRpc(type, network, url);

  if (!result.added) {
    return res.status(409).json({ success: false, error: result.reason });
  }
  return res.json({ success: true, type, network, url });
}

async function handleRemoveRpc(req, res) {
  const error = validate(req.body);
  if (error) return res.status(400).json({ success: false, error });

  const { type, url } = req.body;
  const network = normalizeNetwork(req.body.network);
  const result = await removeRpc(type, network, url);

  if (!result.removed) {
    return res.status(404).json({ success: false, error: result.reason });
  }
  return res.json({ success: true, type, network, url });
}

export { handleAddRpc, handleRemoveRpc };
