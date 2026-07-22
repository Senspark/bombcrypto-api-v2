import { type Contract, parseUnits } from "ethers";
import type { GameContext } from "../context";
import type { CoinToken } from "./coinToken";
import DepositAbi from "../abi/DepositAbi";

// Ported from Module/Deposit.ts. Category selects the pay token (0→BCOIN, 1|2→SEN),
// approve-max the deposit contract, then call depositV3 with the token address.
export class Deposit {
  constructor(
    private readonly ctx: GameContext,
    private readonly bcoin: CoinToken,
    private readonly sen: CoinToken,
    readonly address: string,
  ) {}

  private tokenOf(category: number): CoinToken {
    if (category === 0) return this.bcoin;
    if (category === 1 || category === 2) return this.sen;
    throw new Error(`Invalid deposit category '${category}'`);
  }

  private write(): Contract {
    return this.ctx.write(this.address, DepositAbi);
  }

  // NOTE: method name is depositV3 despite the client method being depositV2.
  async depositV2(user: string, amount: number, category: number): Promise<boolean> {
    try {
      const token = this.tokenOf(category);
      const amountFormatted = parseUnits(amount.toString(), 18);
      await token.approveMaximum(user, this.address, amountFormatted);
      await this.ctx.send(this.write(), "depositV3", [amountFormatted, token.address]);
      return true;
    } catch {
      return false;
    }
  }
}
