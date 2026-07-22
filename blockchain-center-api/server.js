import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { handleGetLogs } from "./handlers/getLogs.js";
import { handleLatestBlockNumber } from "./handlers/latestBlockNumber.js";
import { handleGetTransaction, handleGetTransactionReceipt } from "./handlers/transaction.js";
import { handleGetTransactionCount } from "./handlers/transactionCount.js";
import { handleCallContract } from "./handlers/callContract.js";
import { handleSendRawTransaction } from "./handlers/sendRawTransaction.js";
import { handleGetFeeData } from "./handlers/feeData.js";
import { handleEstimateGas } from "./handlers/estimateGas.js";
import { handleGetBalance } from "./handlers/getBalance.js";
import { handleAnalytics } from "./handlers/analytics.js";
import { handleToggleRpcPause } from "./handlers/rpcControl.js";
import { handleGetBlockTimestamp } from "./handlers/blockTimestamp.js";
import { handleRpcTest } from "./handlers/rpcTest.js";
import { handleAddRpc, handleRemoveRpc } from "./handlers/rpcAdmin.js";
import { initRedis } from "./lib/redisClient.js";
import { initRpcConfig } from "./lib/rpcManager.js";
import { buildAllManagers } from "./utils/rpc.js";
import { runEgressCheck } from "./lib/egress.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Logs all incoming requests and outgoing responses
app.use((req, res, next) => {
  const { method, url } = req;
  if (url !== "/status") {
    const body = Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : "";
    const query = Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : "";
    const params = [body, query].filter(Boolean).join(" ");
    console.log(`REQ ${method} ${url} ${params}`);

    // Intercept res.json to log responses
    // const originalJson = res.json.bind(res);
    // res.json = (data) => {
    //   console.log(`RES ${method} ${url} ${res.statusCode} ${JSON.stringify(data)}`);
    //   return originalJson(data);
    // };
  }
  next();
});

const PORT = process.env.PORT || 3005;

// Routes

// For manager
app.get("/web", (req, res) => {
  res.sendFile(path.join(__dirname, "web", "index.html"));
});
app.get("/status", handleAnalytics);
app.post("/rpc/toggle", handleToggleRpcPause);
app.post("/rpc/test", handleRpcTest);
app.post("/rpc/add", handleAddRpc);
app.post("/rpc/remove", handleRemoveRpc);

// For EVM
app.get("/latestBlockNumber", handleLatestBlockNumber);
app.post("/callContract", handleCallContract);
app.post("/getLogs", handleGetLogs);
app.post("/getTransaction", handleGetTransaction);
app.post("/getTransactionReceipt", handleGetTransactionReceipt);
app.post("/getTransactionCount", handleGetTransactionCount);
app.post("/getBlockTimestamp", handleGetBlockTimestamp);
app.post("/sendRawTransaction", handleSendRawTransaction);
app.post("/getFeeData", handleGetFeeData);
app.post("/estimateGas", handleEstimateGas);
app.post("/getBalance", handleGetBalance);

async function start() {
  // Best-effort Redis: if it's down we fall back to the config file and keep
  // serving requests (a warning is logged and surfaced on /status + /web).
  const connectionString = process.env.REDIS_CONNECTION_STRING || "redis://@redis:6379/0";
  await initRedis(connectionString);
  await initRpcConfig();
  buildAllManagers();
  await runEgressCheck();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);

    console.log(`GET /web - RPC monitoring dashboard`);
    console.log(`GET /status - RPC status + analytics (merged)`);
    console.log(`POST /rpc/toggle - Pause/resume individual RPCs`);
    console.log(`POST /rpc/test - Probe an RPC URL for general use + getLogs support`);
    console.log(`POST /rpc/add - Add an RPC to the list (persisted to Redis)`);
    console.log(`POST /rpc/remove - Remove an RPC from the list (persisted to Redis)`);

    console.log(`GET /latestBlockNumber?network=<network> - Get cached block number`);
    console.log(`POST /callContract - Execute any contract read call`);
    console.log(`POST /getLogs - Fetch Ethereum logs with round-robin RPC`);
    console.log(`POST /getTransaction - Get transaction by hash`);
    console.log(`POST /getTransactionReceipt - Get transaction receipt by hash`);
    console.log(`POST /getTransactionCount - Get transaction count (nonce) for an address (blockTag: latest|pending)`);
    console.log(`POST /getBlockTimestamp - Get block timestamp by number`);
    console.log(`POST /sendRawTransaction - Broadcast a pre-signed raw tx (idempotent by hash)`);
    console.log(`POST /getFeeData - Get gasPrice / EIP-1559 fee data`);
    console.log(`POST /estimateGas - Estimate gas for a tx (from/to/data/value)`);
    console.log(`POST /getBalance - Get native balance for an address`);
  });
}

start();
