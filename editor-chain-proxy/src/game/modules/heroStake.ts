import { type Contract, formatUnits, parseEther } from "ethers";
import type { GameContext } from "../context";
import type { CoinToken } from "./coinToken";
import { waitForReceipt } from "../gas";
import HeroStakeAbi from "../abi/HeroStakeAbi";

export interface StakeResult {
  success: boolean;
  txHash: string;
}

// Ported from Module/BHeroStake.ts. Category selects the staked token (0→BCOIN,
// 1→SEN). deposit/withdraw pass NO gas override (client behaviour) and the token
// address is the first contract arg. txHash is captured before waiting.
export class HeroStake {
  constructor(
    private readonly ctx: GameContext,
    private readonly bcoin: CoinToken,
    private readonly sen: CoinToken,
    readonly address: string,
  ) {}

  private tokenOf(category: number): CoinToken | null {
    if (category === 0) return this.bcoin;
    if (category === 1) return this.sen;
    return null;
  }

  private write(): Contract {
    return this.ctx.write(this.address, HeroStakeAbi);
  }

  private read(): Contract {
    return this.ctx.read(this.address, HeroStakeAbi);
  }

  async depositV2(user: string, id: number, amount: number, category: number): Promise<StakeResult> {
    try {
      const token = this.tokenOf(category);
      if (!token) return { success: false, txHash: "" };
      const amountBN = parseEther(amount.toString());
      await token.approveMaximum(user, this.address, amountBN);
      const tx = await this.write().getFunction("depositV2")(token.address, id, amountBN);
      const txHash: string = tx.hash ?? "";
      await waitForReceipt(tx);
      return { success: true, txHash };
    } catch {
      return { success: false, txHash: "" };
    }
  }

  async withdrawV2(id: number, amount: number, category: number): Promise<StakeResult> {
    try {
      const token = this.tokenOf(category);
      if (!token) return { success: false, txHash: "" };
      const amountBN = parseEther(amount.toString());
      // Withdraw needs no approve (contract transfers back to the user).
      const tx = await this.write().getFunction("withdrawV2")(token.address, id, amountBN);
      const txHash: string = tx.hash ?? "";
      await waitForReceipt(tx);
      return { success: true, txHash };
    } catch {
      return { success: false, txHash: "" };
    }
  }

  async getCoinBalanceV2(id: number, category: number): Promise<string> {
    try {
      const token = this.tokenOf(category);
      if (!token) return "0";
      const raw = await this.read().getFunction("getCoinBalanceV2")(token.address, id);
      return formatUnits(raw.toString(), 18);
    } catch {
      return "0";
    }
  }

  async getWithdrawFeeV2(id: number, category: number): Promise<string> {
    try {
      const token = this.tokenOf(category);
      if (!token) return "0";
      const raw = await this.read().getFunction("getWithdrawFeeV2")(token.address, id);
      return raw.toString();
    } catch {
      return "0";
    }
  }
}
