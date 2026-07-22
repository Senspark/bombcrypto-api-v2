import "dotenv/config";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { config } from "./config";
import { logger } from "./logger";
import { NETWORKS } from "./networks";
import { handleCall, handleSend } from "./chain";
import { handleGame } from "./game/handler";
import { HttpError } from "./errors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "32kb" }));

// Redact secrets before logging — the request body may carry a throwaway key.
function safeBody(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const b = { ...(body as Record<string, unknown>) };
  if ("privateKey" in b) b.privateKey = "***";
  return b;
}

// Log every request (redacted) and its response, so the dev can see exactly what
// the Editor called and what came back.
function wrap(label: string, fn: (body: unknown) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    logger.info(`→ ${label}`, JSON.stringify(safeBody(req.body)));
    try {
      const data = await fn(req.body);
      const payload = { success: true, ...(data as object) };
      logger.info(`← ${label} 200`, JSON.stringify(payload));
      res.json(payload);
    } catch (e) {
      const err = e as { status?: number; shortMessage?: string; reason?: string; message?: string };
      const status = err instanceof HttpError ? err.status : 500;
      const message = err.shortMessage || err.reason || err.message || "error";
      logger.error(`← ${label} ${status}`, message); // never log the request body (may hold a key)
      res.status(status).json({ success: false, error: message, reason: err.reason ?? null });
    }
  };
}

app.get("/health", (_req, res) => {
  res.json({ success: true, service: "editor-chain-proxy", testnetOnly: true, networks: Object.keys(NETWORKS) });
});
app.post("/call", wrap("POST /call", handleCall));
app.post("/send", wrap("POST /send", handleSend));
app.post("/game", wrap("POST /game", handleGame));

app.listen(config.PORT, config.HOST, () => {
  logger.info(
    `editor-chain-proxy on http://${config.HOST}:${config.PORT} — testnet-only, networks: ${Object.keys(NETWORKS).join(", ")}`,
  );
});
