import type { JsonRpcProvider, TransactionReceipt, TransactionResponse } from "ethers";
import { logger } from "../logger";

// Ported from the client's NetworkUtils.getDoubleGasFeeOptionV2 / waitForReceipt.
// Two deviations, both deliberate for an Editor dev tool:
//  - CONFIRMATIONS = 1 (client uses 6) so the Editor's HTTP call returns promptly.
//  - Only the two whitelisted testnets exist here; mainnet (137/56) is blocked
//    upstream, so the Polygon-fee path only ever runs for Amoy (80002).
export const CONFIRMATIONS = 1;

const GAS_LIMIT_MULTIPLIER = 2n;
// EIP-1559 fees are only added for Polygon chains (client behaviour). BSC gets a
// gasLimit override only.
const POLYGON_CHAIN_IDS = new Set<number>([137, 80002]);
// Polygon/Amoy rejects tx with priority fee below ~25 gwei; 30 gives a buffer.
const POLYGON_MIN_PRIORITY_FEE = 30_000_000_000n;
const GAS_FEE_PREMIUM = 120n; // ×1.2 over the fetched priority fee
// Static last-resort fees per chain (client POLYGON_STATIC_FEE table).
const POLYGON_STATIC_FEE: Record<number, { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> = {
  137: { maxFeePerGas: 300_000_000_000n, maxPriorityFeePerGas: 40_000_000_000n },
  80002: { maxFeePerGas: 100_000_000_000n, maxPriorityFeePerGas: 30_000_000_000n },
};

export interface GasOverrides {
  gasLimit: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

function clampPriority(fee: bigint): bigint {
  return fee < POLYGON_MIN_PRIORITY_FEE ? POLYGON_MIN_PRIORITY_FEE : fee;
}

async function resolvePolygonFees(
  provider: JsonRpcProvider,
  chainId: number,
): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
  try {
    const feeData = await provider.getFeeData();
    if (feeData.maxPriorityFeePerGas != null && feeData.maxFeePerGas != null) {
      const priority = clampPriority((feeData.maxPriorityFeePerGas * GAS_FEE_PREMIUM) / 100n);
      const base = feeData.maxFeePerGas - feeData.maxPriorityFeePerGas;
      return { maxFeePerGas: base + priority, maxPriorityFeePerGas: priority };
    }
  } catch (e) {
    logger.error(`getFeeData failed on ${chainId}, using static fees`, (e as Error).message);
  }
  return POLYGON_STATIC_FEE[chainId] ?? POLYGON_STATIC_FEE[80002];
}

// gasLimit ×2 always; Polygon chains additionally get EIP-1559 fees with the
// priority-fee floor. Mirrors getDoubleGasFeeOptionV2.
export async function gasOverrides(
  provider: JsonRpcProvider,
  chainId: number,
  estimateGas: bigint,
): Promise<GasOverrides> {
  const gasLimit = estimateGas * GAS_LIMIT_MULTIPLIER;
  if (!POLYGON_CHAIN_IDS.has(chainId)) return { gasLimit };
  const fees = await resolvePolygonFees(provider, chainId);
  return { gasLimit, ...fees };
}

export async function waitForReceipt(tx: TransactionResponse): Promise<TransactionReceipt | null> {
  return tx.wait(CONFIRMATIONS);
}
