import { type Contract, toBigInt } from "ethers";
import type { GameContext } from "../context";
import type { CoinToken } from "./coinToken";
import HouseTokenAbi from "../abi/HouseTokenAbi";
import HouseDesignAbi from "../abi/HouseDesignAbi";
import { bnArrayToStrings, bn2dArrayToStrings } from "../util";

// Ported from Module/BHouse.ts (extends NFTToken). Reads split between the House
// token (getMintAvailable, getTokenDetailsByOwner) and its design contract.
export class BHouse {
  private _design: Contract | null = null;

  constructor(
    private readonly ctx: GameContext,
    private readonly bcoin: CoinToken,
    readonly address: string,
  ) {}

  private mainRead(): Contract {
    return this.ctx.read(this.address, HouseTokenAbi);
  }

  private mainWrite(): Contract {
    return this.ctx.write(this.address, HouseTokenAbi);
  }

  private async design(): Promise<Contract> {
    if (!this._design) {
      this._design = await this.ctx.designOf(this.mainRead(), HouseDesignAbi);
    }
    return this._design;
  }

  async getTokenLimit(): Promise<string> {
    return (await (await this.design()).getFunction("getTokenLimit")()).toString();
  }

  async getMintCost(rarity: number): Promise<string> {
    return (await (await this.design()).getFunction("getMintCost")(rarity)).toString();
  }

  async getMintCosts(): Promise<string[]> {
    return bnArrayToStrings((await (await this.design()).getFunction("getMintCosts")()) as ArrayLike<unknown>);
  }

  // getMintAvailable lives on the main contract, not the design.
  async getMintAvailable(): Promise<string[]> {
    return bnArrayToStrings((await this.mainRead().getFunction("getMintAvailable")()) as ArrayLike<unknown>);
  }

  async getMintLimits(): Promise<string[]> {
    return bnArrayToStrings((await (await this.design()).getFunction("getMintLimits")()) as ArrayLike<unknown>);
  }

  async getRarityStats(): Promise<string[][]> {
    return bn2dArrayToStrings(
      (await (await this.design()).getFunction("getRarityStats")()) as ArrayLike<ArrayLike<unknown>>,
    );
  }

  async mint(user: string, rarity: number): Promise<boolean> {
    try {
      const cost = await this.getMintCost(rarity);
      await this.bcoin.checkAllowance(user, this.address, toBigInt(cost));
      await this.ctx.send(this.mainWrite(), "mint", [rarity]);
      return true;
    } catch {
      return false;
    }
  }
}
