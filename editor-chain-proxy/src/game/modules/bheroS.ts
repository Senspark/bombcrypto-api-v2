import { type Contract, toBigInt } from "ethers";
import type { GameContext } from "../context";
import type { CoinToken } from "./coinToken";
import type { BHero } from "./bhero";
import HeroSTokenAbi from "../abi/HeroSTokenAbi";

// Ported from Module/BHeroS.ts. Shares the Hero design contract (borrowed from
// BHero). Shield/fusion/rock ops take no token allowance; only mint does (BCOIN).
export class BHeroS {
  private _coinCost: bigint | null = null;
  private _senCost: bigint | null = null;

  constructor(
    private readonly ctx: GameContext,
    private readonly bcoin: CoinToken,
    private readonly bhero: BHero,
    readonly address: string,
  ) {}

  private mainWrite(): Contract {
    return this.ctx.write(this.address, HeroSTokenAbi);
  }

  private mainRead(): Contract {
    return this.ctx.read(this.address, HeroSTokenAbi);
  }

  // HeroS-specific mint costs live on the shared Hero design contract.
  async getMintCost(): Promise<string> {
    if (this._coinCost == null) {
      const design = await this.bhero.designContract();
      this._coinCost = toBigInt(await design.getFunction("getMintCostHeroS")());
    }
    return this._coinCost.toString();
  }

  async getSenMintCost(): Promise<string> {
    if (this._senCost == null) {
      const design = await this.bhero.designContract();
      this._senCost = toBigInt(await design.getFunction("getSenMintCostHeroS")());
    }
    return this._senCost.toString();
  }

  async getHeroPrice(): Promise<{ coin: string; sen: string }> {
    return { coin: await this.getMintCost(), sen: await this.getSenMintCost() };
  }

  // getTotalRockByUser raced against a 5s timeout resolving 0 (client behaviour).
  async getAmountRock(user: string): Promise<number> {
    try {
      const read = (async () => Number(await this.mainRead().getFunction("getTotalRockByUser")(user)))();
      const timeout = new Promise<number>((r) => setTimeout(() => r(0), 5000));
      return await Promise.race([read, timeout]);
    } catch {
      return 0;
    }
  }

  async mint(user: string, count: number): Promise<boolean> {
    try {
      const cost = await this.getHeroPrice();
      // Pricing uses double the count (client quirk); the tx sends the plain count.
      const countBN = toBigInt(count * 2);
      const coinBN = toBigInt(cost.coin) * countBN;
      await this.bcoin.checkAllowance(user, this.address, coinBN);
      await this.ctx.send(this.mainWrite(), "mint", [count]);
      return true;
    } catch {
      return false;
    }
  }

  async burnFusion(heroIds: number[]): Promise<boolean> {
    return this.write("burnListToken", [heroIds]);
  }

  async fusion(mainMaterials: number[], buffMaterials: number[]): Promise<boolean> {
    return this.write("fusion", [mainMaterials, buffMaterials]);
  }

  async burnRepairShield(idHeroS: number, listHeroIds: number[]): Promise<boolean> {
    return this.write("burnResetShield", [idHeroS, listHeroIds]);
  }

  async resetShieldHeroS(idHero: number, amountRock: number): Promise<boolean> {
    return this.write("resetShieldHeroS", [idHero, amountRock]);
  }

  // Legacy 2-arg form is absent from the ABI (only the V2 3-arg exists); kept for
  // parity — it errors → false, which matches the dead client path.
  async upgradeShieldLevel(idHero: number, amountRock: number): Promise<boolean> {
    return this.write("upgradeShieldLevel", [idHero, amountRock]);
  }

  async upgradeShieldLevelV2(idHero: number, nonce: number, signature: string): Promise<boolean> {
    return this.write("upgradeShieldLevel", [idHero, nonce, signature]);
  }

  // createRock returns the tx hash string (or "" on failure), unlike the booleans.
  async createRock(listHeroIds: number[]): Promise<string> {
    try {
      const receipt = await this.ctx.send(this.mainWrite(), "createRock", [listHeroIds]);
      return receipt?.hash?.toString() ?? "";
    } catch {
      return "";
    }
  }

  private async write(name: string, args: unknown[]): Promise<boolean> {
    try {
      await this.ctx.send(this.mainWrite(), name, args);
      return true;
    } catch {
      return false;
    }
  }
}
