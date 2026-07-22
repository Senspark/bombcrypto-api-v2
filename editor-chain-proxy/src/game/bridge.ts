import { Contract, JsonRpcProvider, MaxUint256, Wallet, formatUnits } from "ethers";
import { logger } from "../logger";
import { bridgeAddress, tokenAddress } from "./addresses";
import { BRIDGE_ABI, ERC20_ABI } from "./abi";

const AMOY_CHAIN_ID = 80002;
// Amoy rejects tx with priority fee below ~25 gwei; mirror the React client's floor.
const AMOY_MIN_PRIORITY_FEE = 30_000_000_000n;

export interface TxResult {
  txHash: string;
  status: number | null;
  blockNumber: number | null;
  // Net token amount received (after fee), read from the on-chain Withdraw event.
  // Present only for withdraw. Bridge tokens are 18-decimals.
  net?: number;
}

// gasLimit x2 (matches the React client). On Amoy, also pin an EIP-1559 fee that
// clears the network's priority-fee floor, otherwise the tx is silently dropped.
async function gasOverrides(
  provider: JsonRpcProvider,
  chainId: number,
  estimateGas: bigint,
): Promise<Record<string, bigint>> {
  const gasLimit = estimateGas * 2n;
  if (chainId !== AMOY_CHAIN_ID) return { gasLimit };

  const feeData = await provider.getFeeData();
  let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? AMOY_MIN_PRIORITY_FEE;
  if (maxPriorityFeePerGas < AMOY_MIN_PRIORITY_FEE) maxPriorityFeePerGas = AMOY_MIN_PRIORITY_FEE;
  const baseFee = (feeData.maxFeePerGas ?? maxPriorityFeePerGas * 2n) - (feeData.maxPriorityFeePerGas ?? 0n);
  const candidate = baseFee + maxPriorityFeePerGas;
  const maxFeePerGas = candidate > maxPriorityFeePerGas ? candidate : maxPriorityFeePerGas * 2n;
  return { gasLimit, maxFeePerGas, maxPriorityFeePerGas };
}

// The DepositBridge on-chain gateway, running against a testnet RPC with a
// throwaway key. `network` is the canonical name (bsctestnet | amoy).
export class Bridge {
  constructor(
    private readonly provider: JsonRpcProvider,
    private readonly network: string,
    private readonly chainId: number,
  ) {}

  async deposited(user: string, token: string): Promise<string> {
    const c = new Contract(bridgeAddress(this.network), BRIDGE_ABI, this.provider);
    const v: bigint = await c.deposited(user, tokenAddress(this.network, token));
    return v.toString();
  }

  async withdrawn(user: string, token: string): Promise<string> {
    const c = new Contract(bridgeAddress(this.network), BRIDGE_ABI, this.provider);
    const v: bigint = await c.withdrawn(user, tokenAddress(this.network, token));
    return v.toString();
  }

  async depositEnabled(): Promise<boolean> {
    const c = new Contract(bridgeAddress(this.network), BRIDGE_ABI, this.provider);
    return c.depositEnabled();
  }

  async withdrawEnabled(): Promise<boolean> {
    const c = new Contract(bridgeAddress(this.network), BRIDGE_ABI, this.provider);
    return c.withdrawEnabled();
  }

  // approve-if-needed (like the React client) then deposit(token, amount).
  async deposit(privateKey: string, token: string, amountWei: string): Promise<TxResult> {
    const wallet = new Wallet(privateKey, this.provider);
    const tokenAddr = tokenAddress(this.network, token);
    const bridgeAddr = bridgeAddress(this.network);
    const amount = BigInt(amountWei);

    await this.ensureAllowance(wallet, tokenAddr, bridgeAddr, amount);

    const bridge = new Contract(bridgeAddr, BRIDGE_ABI, wallet);
    const est = await bridge.deposit.estimateGas(tokenAddr, amount);
    const overrides = await gasOverrides(this.provider, this.chainId, est);
    logger.info(`bridge deposit ${this.network} ${token} amount=${amount} from ${wallet.address}`);
    const tx = await bridge.deposit(tokenAddr, amount, overrides);
    return receiptOf(tx);
  }

  // withdraw(token, otherDeposited, deadline, signature): the contract self-computes
  // amount = otherDeposited − withdrawn[user][token]. No user allowance is needed —
  // the contract transfers net FROM itself TO msg.sender (safeTransfer).
  async withdraw(
    privateKey: string,
    token: string,
    otherDepositedWei: string,
    deadline: string,
    signature: string,
  ): Promise<TxResult> {
    const wallet = new Wallet(privateKey, this.provider);
    const tokenAddr = tokenAddress(this.network, token);
    const bridge = new Contract(bridgeAddress(this.network), BRIDGE_ABI, wallet);
    const otherDeposited = BigInt(otherDepositedWei);
    const deadlineSec = BigInt(deadline);
    const est = await bridge.withdraw.estimateGas(tokenAddr, otherDeposited, deadlineSec, signature);
    const overrides = await gasOverrides(this.provider, this.chainId, est);
    logger.info(`bridge withdraw ${this.network} ${token} otherDeposited=${otherDeposited} deadline=${deadlineSec} from ${wallet.address}`);
    const tx = await bridge.withdraw(tokenAddr, otherDeposited, deadlineSec, signature, overrides);
    const receipt = (await tx.wait()) as
      | { status?: number | null; blockNumber?: number | null; logs?: Array<{ topics: readonly string[]; data: string }> }
      | null;
    return {
      txHash: tx.hash,
      status: receipt?.status ?? null,
      blockNumber: receipt?.blockNumber ?? null,
      net: netFromReceipt(bridge, receipt),
    };
  }

  private async ensureAllowance(wallet: Wallet, tokenAddr: string, spender: string, amount: bigint): Promise<void> {
    const token = new Contract(tokenAddr, ERC20_ABI, wallet);
    const current: bigint = await token.allowance(wallet.address, spender);
    if (current >= amount) return;
    logger.info(`bridge approve ${tokenAddr} -> ${spender} (allowance ${current} < ${amount})`);
    const tx = await token.approve(spender, MaxUint256);
    await tx.wait();
  }
}

// Exact net received (after fee) from the on-chain Withdraw event — more accurate
// than a client-side fee estimate. Bridge tokens are 18-decimals.
function netFromReceipt(
  bridge: Contract,
  receipt: { logs?: Array<{ topics: readonly string[]; data: string }> } | null,
): number {
  for (const log of receipt?.logs ?? []) {
    try {
      const parsed = bridge.interface.parseLog(log);
      if (parsed && parsed.name === "Withdraw") return Number(formatUnits(parsed.args.net, 18));
    } catch {
      // log from another contract (e.g. ERC20 Transfer) — skip
    }
  }
  return 0;
}

async function receiptOf(tx: { hash: string; wait: () => Promise<unknown> }): Promise<TxResult> {
  const receipt = (await tx.wait()) as { status?: number | null; blockNumber?: number | null } | null;
  return {
    txHash: tx.hash,
    status: receipt?.status ?? null,
    blockNumber: receipt?.blockNumber ?? null,
  };
}
