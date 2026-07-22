import { type Contract, MaxUint256, toBigInt } from "ethers";
import type { GameContext } from "../context";
import CoinTokenAbi from "../abi/CoinTokenAbi";

// ERC-20 wrapper (BCOIN / SEN), ported from Module/CoinToken.ts. Two distinct
// approve strategies are preserved verbatim because callers depend on them:
//  - approveMaximum → approves MaxUint256 (used by Deposit / BHeroStake).
//  - checkAllowance → approves 10× the amount (used by BHero / BHouse mint).
export class CoinToken {
  constructor(
    private readonly ctx: GameContext,
    readonly address: string,
  ) {}

  async getBalance(user: string): Promise<string> {
    const c = this.ctx.read(this.address, CoinTokenAbi);
    const balance = await c.getFunction("balanceOf")(user);
    return balance.toString();
  }

  async getAllowance(user: string, spender: string): Promise<bigint> {
    const c = this.ctx.read(this.address, CoinTokenAbi);
    return await c.getFunction("allowance")(user, spender);
  }

  // Approve MaxUint256 if the current allowance can't cover `amount`. Uses the
  // default 1-confirmation wait (like the client), not waitForReceipt.
  async approveMaximum(user: string, spender: string, amount: bigint): Promise<boolean> {
    const allowance = await this.getAllowance(user, spender);
    if (amount <= allowance) return true;
    const c = this.ctx.write(this.address, CoinTokenAbi);
    const tx = await c.getFunction("approve")(spender, MaxUint256);
    await tx.wait();
    return true;
  }

  // Approve 10× the requested amount if the current allowance falls short.
  async checkAllowance(user: string, spender: string, amount: bigint): Promise<void> {
    const amountBN = toBigInt(amount);
    const allowance = await this.getAllowance(user, spender);
    if (amountBN <= allowance) return;
    const c = this.ctx.write(this.address, CoinTokenAbi);
    const tx = await c.getFunction("approve")(spender, amountBN * 10n);
    await tx.wait();
  }

  contractWrite(): Contract {
    return this.ctx.write(this.address, CoinTokenAbi);
  }
}
