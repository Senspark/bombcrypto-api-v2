// Centralized Redis key declarations. Redis is shared across many projects, so
// every key is namespaced under AP:BCTR: (AP = bombcrypto-api, BCTR = blockchain-center).
const PREFIX = "AP:BCTR";

const RedisKeys = {
  // JSON string: { getLogs: { [network]: string[] }, general: { [network]: string[] } }
  RPC_LIST: `${PREFIX}:RPC:LIST`,
  // Set of paused RPC URLs
  RPC_PAUSED: `${PREFIX}:RPC:PAUSED`,
};

export { RedisKeys };
