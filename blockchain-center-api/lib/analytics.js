class Analytics {
  constructor() {
    this.serverStartTime = Date.now();
    this.allRpcsOnCooldownCount = 0;
    this.rpcStats = {};
  }

  recordCooldownWait() {
    this.allRpcsOnCooldownCount++;
  }

  recordRpcCall(url) {
    this.ensureRpcStats(url);
    this.rpcStats[url].calls++;
  }

  recordSuccess(url) {
    this.ensureRpcStats(url);
    this.rpcStats[url].successes++;
    this.rpcStats[url].consecutiveFailures = 0;
  }

  recordFailure(url) {
    this.ensureRpcStats(url);
    this.rpcStats[url].failures++;
    this.rpcStats[url].consecutiveFailures++;
  }

  ensureRpcStats(url) {
    if (!this.rpcStats[url]) {
      this.rpcStats[url] = { calls: 0, successes: 0, failures: 0, consecutiveFailures: 0 };
    }
  }

  // Clear counters for a URL (used when an RPC is resumed, so it's easy to watch).
  resetRpc(url) {
    this.rpcStats[url] = { calls: 0, successes: 0, failures: 0, consecutiveFailures: 0 };
  }

  removeRpc(url) {
    delete this.rpcStats[url];
  }

  getStats() {
    return {
      serverStartTime: this.serverStartTime,
      elapsedMs: Date.now() - this.serverStartTime,
      allRpcsOnCooldownCount: this.allRpcsOnCooldownCount,
      rpcStats: this.rpcStats,
    };
  }
}

const analytics = new Analytics();
export { analytics, Analytics };
