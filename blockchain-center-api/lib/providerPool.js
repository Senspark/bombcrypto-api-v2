import { JsonRpcProvider } from "ethers";

/**
 * ProviderPool manages persistent JsonRpcProvider instances to reduce
 * the overhead of creating new connections for each RPC call.
 * 
 * Performance gain: ~100-200ms per call by avoiding repeated discovery/initialization.
 */
class ProviderPool {
  constructor() {
    this.providers = new Map();
  }

  /**
   * Get an existing provider for a URL or create a new one.
   * @param {string} rpcUrl 
   * @returns {JsonRpcProvider}
   */
  getProvider(rpcUrl) {
    if (!this.providers.has(rpcUrl)) {
      const provider = new JsonRpcProvider(rpcUrl, undefined, {
        staticNetwork: true, // Optimizes by skipping 'eth_chainId' on every request
      });
      this.providers.set(rpcUrl, provider);
    }
    return this.providers.get(rpcUrl);
  }

  /**
   * Remove a provider from the pool (e.g. on persistent failure).
   * @param {string} rpcUrl 
   */
  deleteProvider(rpcUrl) {
    const provider = this.providers.get(rpcUrl);
    if (provider) {
      try {
        // provider.destroy() exists in ethers v6 to cleanup listeners/timers
        provider.destroy();
      } catch (e) {
        // Silently fail if already destroyed
      }
      this.providers.delete(rpcUrl);
    }
  }

  /**
   * Clear all providers from the pool.
   */
  clear() {
    for (const url of this.providers.keys()) {
      this.deleteProvider(url);
    }
  }
}

export const providerPool = new ProviderPool();
