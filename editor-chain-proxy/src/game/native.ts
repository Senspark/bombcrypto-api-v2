import { Contract, JsonRpcProvider, Wallet, formatUnits } from "ethers";
import { logger } from "../logger";
import { nativeAddress } from "./addresses";
import { NATIVE_ABI } from "./abi";
import { gasOverrides } from "./gas";
import type { TxResult } from "./bridge";

// The DepositNative on-chain vault (native BNB / POL), running against a testnet
// RPC with a throwaway key. deposit() is payable — the amount rides in msg.value,
// no token address and no approve. withdraw is user-relayed withdraw-MAX: the
// contract self-computes amount = allowedCumulative − withdrawn[user], so no
// caller approve and no amount in the request. `network` is bsctestnet | amoy.
export class Native {
  constructor(
    private readonly provider: JsonRpcProvider,
    private readonly network: string,
    private readonly chainId: number,
  ) {}

  private read(): Contract {
    return new Contract(nativeAddress(this.network), NATIVE_ABI, this.provider);
  }

  async deposited(user: string): Promise<string> {
    const v: bigint = await this.read().deposited(user);
    return v.toString();
  }

  async withdrawn(user: string): Promise<string> {
    const v: bigint = await this.read().withdrawn(user);
    return v.toString();
  }

  // The user's spendable native coin balance (BNB / POL) in their wallet, formatted to coin units
  // for a display-only "available" cap. Display precision is fine here (the deposit amount itself is
  // reconverted to exact wei before the payable tx).
  async walletBalance(user: string): Promise<number> {
    const bal: bigint = await this.provider.getBalance(user);
    return Number(formatUnits(bal, 18));
  }

  async depositEnabled(): Promise<boolean> {
    return this.read().depositEnabled();
  }

  async withdrawEnabled(): Promise<boolean> {
    return this.read().withdrawEnabled();
  }

  // payable deposit — the amount is msg.value, no token, no approve.
  async deposit(privateKey: string, amountWei: string): Promise<TxResult> {
    const wallet = new Wallet(privateKey, this.provider);
    const contract = new Contract(nativeAddress(this.network), NATIVE_ABI, wallet);
    const value = BigInt(amountWei);
    const est = await contract.deposit.estimateGas({ value });
    const overrides = await gasOverrides(this.provider, this.chainId, est);
    logger.info(`native deposit ${this.network} value=${value} from ${wallet.address}`);
    const tx = await contract.deposit({ ...overrides, value });
    const receipt = (await tx.wait()) as { status?: number | null; blockNumber?: number | null } | null;
    return { txHash: tx.hash, status: receipt?.status ?? null, blockNumber: receipt?.blockNumber ?? null };
  }

  // withdraw(allowedCumulative, deadline, signature): the contract pays out
  // amount = allowedCumulative − withdrawn[user] to msg.sender. No approve.
  async withdraw(
    privateKey: string,
    allowedCumulativeWei: string,
    deadline: string,
    signature: string,
  ): Promise<TxResult> {
    const wallet = new Wallet(privateKey, this.provider);
    const contract = new Contract(nativeAddress(this.network), NATIVE_ABI, wallet);
    const allowedCumulative = BigInt(allowedCumulativeWei);
    const deadlineSec = BigInt(deadline);
    const est = await contract.withdraw.estimateGas(allowedCumulative, deadlineSec, signature);
    const overrides = await gasOverrides(this.provider, this.chainId, est);
    logger.info(
      `native withdraw ${this.network} allowedCumulative=${allowedCumulative} deadline=${deadlineSec} from ${wallet.address}`,
    );
    const tx = await contract.withdraw(allowedCumulative, deadlineSec, signature, overrides);
    const receipt = (await tx.wait()) as
      | { status?: number | null; blockNumber?: number | null; logs?: Array<{ topics: readonly string[]; data: string }> }
      | null;
    return {
      txHash: tx.hash,
      status: receipt?.status ?? null,
      blockNumber: receipt?.blockNumber ?? null,
      net: netFromReceipt(contract, receipt),
    };
  }
}

// The native amount paid out (no fee), read from the on-chain NativeWithdrawn
// event. Native is 18-decimals. Falls back to 0 if the event is absent.
function netFromReceipt(
  contract: Contract,
  receipt: { logs?: Array<{ topics: readonly string[]; data: string }> } | null,
): number {
  for (const log of receipt?.logs ?? []) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === "NativeWithdrawn") return Number(formatUnits(parsed.args.amount, 18));
    } catch {
      // log from another contract — skip
    }
  }
  return 0;
}
