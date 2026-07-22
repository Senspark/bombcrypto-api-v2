import { HttpError } from "./errors";

export interface NetworkCfg {
  name: string;
  chainId: number;
  rpcUrl: string;
}

// Guardrail #1: only these testnet chainIds are ever allowed. Mainnet (56 bsc,
// 137 polygon) is absent by design and additionally rejected at runtime by the
// real-chainId check in chain.ts.
export const TESTNET_CHAIN_IDS = new Set<number>([97, 80002]);

const DEFS: Record<string, { chainId: number; rpcUrl: string }> = {
  bsctestnet: {
    chainId: 97,
    rpcUrl: process.env.BSCTESTNET_RPC || "https://data-seed-prebsc-1-s1.binance.org:8545",
  },
  amoy: {
    chainId: 80002,
    rpcUrl: process.env.AMOY_RPC || "https://rpc-amoy.polygon.technology/",
  },
};

export const NETWORKS: Record<string, NetworkCfg> = {};
for (const [name, d] of Object.entries(DEFS)) NETWORKS[name] = { name, ...d };
// Aliases matching the hardhat network keys, so the Editor can reuse the same names.
NETWORKS.polygontestnet = { ...NETWORKS.amoy, name: "amoy" };
NETWORKS.polygonAmoy = { ...NETWORKS.amoy, name: "amoy" };

export function resolveNetwork(name: string): NetworkCfg {
  const net = NETWORKS[name];
  if (!net) {
    throw new HttpError(400, `Unknown network '${name}'. Allowed: ${Object.keys(NETWORKS).join(", ")}`);
  }
  return net;
}
