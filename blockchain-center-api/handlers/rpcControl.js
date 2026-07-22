import { toggleRpcPause } from "../lib/rpcManager.js";

async function handleToggleRpcPause(req, res) {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "url is required" });
  }
  const paused = await toggleRpcPause(url);
  return res.json({ success: true, url, paused });
}

export { handleToggleRpcPause };
