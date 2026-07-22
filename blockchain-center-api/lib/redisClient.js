import { createClient } from "redis";

// Single shared Redis client. Connection is best-effort: if Redis is down the
// service keeps serving RPC requests from the in-memory list and only loses
// persistence (callers check isRedisConnected() before relying on it).
let client = null;
let connected = false;
let lastErrorMsg = null;

async function initRedis(connectionString) {
  client = createClient({ url: connectionString });

  client.on("ready", () => {
    connected = true;
    lastErrorMsg = null;
    console.log("Redis connected");
  });
  client.on("error", (e) => {
    connected = false;
    if (e.message !== lastErrorMsg) {
      console.warn(`Redis error: ${e.message}`);
      lastErrorMsg = e.message;
    }
  });
  client.on("end", () => {
    connected = false;
  });
  client.on("reconnecting", () => {
    console.warn("Redis reconnecting...");
  });

  try {
    await client.connect();
  } catch (e) {
    console.warn(`Redis connect failed: ${e.message}. Continuing without persistence.`);
  }
  return client;
}

function isRedisConnected() {
  return connected;
}

function getRedis() {
  return client;
}

export { initRedis, isRedisConnected, getRedis };
