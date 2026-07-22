import { allNetworks, rpcManagersForLogs, rpcManagersGeneral } from "../utils/rpc.js";
import { analytics } from "../lib/analytics.js";
import { isRedisConnected } from "../lib/redisClient.js";
import { getEgressStatus } from "../lib/egress.js";

function handleAnalytics(req, res) {
  const status = {};

  for (const network of allNetworks) {
    status[network] = {
      getLogs: rpcManagersForLogs[network].getStatus(),
      general: rpcManagersGeneral[network].getStatus(),
    };
  }

  const stats = analytics.getStats();

  return res.json({
    ...stats,
    redis: { connected: isRedisConnected() },
    egress: getEgressStatus(),
    status,
  });
}

export { handleAnalytics };
