import { type Contract, toBigInt } from "ethers";
import type { GameContext } from "../context";
import type { CoinToken } from "./coinToken";
import HeroTokenAbi from "../abi/HeroTokenAbi";
import HeroDesignAbi from "../abi/HeroDesignAbi";
import { bn2dArrayToStrings } from "../util";

const HERO_S_PRICE_MULTIPLIER = 5n;
// Guard against a never-converging poll in processTokenRequestsV2 (the client
// loops forever; a dev tool must not hang the Editor's HTTP call indefinitely).
const MAX_PROCESS_POLLS = 30;
const POLL_INTERVAL_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Ported from Module/BHero.ts (extends NFTToken). Main reads/writes hit the Hero
// token; cost/limit reads hit its on-chain design contract (resolved via design()).
export class BHero {
  private _design: Contract | null = null;

  constructor(
    private readonly ctx: GameContext,
    private readonly bcoin: CoinToken,
    readonly address: string,
  ) {}

  private mainRead(): Contract {
    return this.ctx.read(this.address, HeroTokenAbi);
  }

  private mainWrite(): Contract {
    return this.ctx.write(this.address, HeroTokenAbi);
  }

  private async design(): Promise<Contract> {
    if (!this._design) {
      this._design = await this.ctx.designOf(this.mainRead(), HeroDesignAbi);
    }
    return this._design;
  }

  // BHeroS borrows the Hero design contract (same design instance).
  designContract(): Promise<Contract> {
    return this.design();
  }

  // ── design reads ──
  async getTokenLimit(): Promise<string> {
    return (await (await this.design()).getFunction("getTokenLimit")()).toString();
  }

  async getMintCost(): Promise<string> {
    return (await (await this.design()).getFunction("getMintCost")()).toString();
  }

  async getSenMintCost(): Promise<string> {
    return (await (await this.design()).getFunction("getSenMintCost")()).toString();
  }

  async getSuperBoxMintCost(): Promise<string> {
    return (await (await this.design()).getFunction("getSuperBoxMintCost")()).toString();
  }

  async getHeroPrice(category: number): Promise<string> {
    switch (category) {
      case 0:
        return this.getMintCost();
      case 1:
        return this.getSenMintCost();
      case 2:
        return this.getSuperBoxMintCost();
      default:
        throw new Error("Invalid request");
    }
  }

  async getUpgradeCost(rarity: number, level: number): Promise<string> {
    return (await (await this.design()).getFunction("getUpgradeCost")(rarity, level)).toString();
  }

  async getUpgradeCosts(): Promise<string[][]> {
    const raw = await (await this.design()).getFunction("getUpgradeCosts")();
    return bn2dArrayToStrings(raw as ArrayLike<ArrayLike<unknown>>);
  }

  async getRandomizeAbilityCost(rarity: number, times: number): Promise<string> {
    return (await (await this.design()).getFunction("getRandomizeAbilityCost")(rarity, times)).toString();
  }

  async getAbilityDesigns(): Promise<string[][]> {
    const raw = (await (await this.design()).getFunction("getAbilityDesigns")()) as ArrayLike<ArrayLike<unknown>>;
    return Array.from(raw, (row) => {
      const r = row as ArrayLike<{ toString(): string }>;
      return [r[0].toString(), r[1].toString(), r[2].toString()];
    });
  }

  // ── main reads ──
  async getIdCounter(): Promise<string> {
    return (await this.mainRead().getFunction("tokenIdCounter")()).toString();
  }

  async isSuperBoxEnabled(): Promise<boolean> {
    return await this.mainRead().getFunction("isSuperBoxEnabled")();
  }

  async getClaimableTokens(user: string): Promise<string> {
    return (await this.mainRead().getFunction("getClaimableTokens")(user)).toString();
  }

  async getPendingTokens(user: string): Promise<{ pendingHeroes: number; pendingHeroesFusion: number }> {
    const pending = await this.mainRead().getFunction("getPendingTokens")(user);
    return { pendingHeroes: parseInt(pending.toString(), 10), pendingHeroesFusion: 0 };
  }

  async getPendingTokensV2(user: string): Promise<{ pendingHeroes: number; pendingHeroesFusion: number }> {
    const res = await this.mainRead().getFunction("getPendingTokensV2")(user);
    return {
      pendingHeroes: parseInt(res[0].toString(), 10),
      pendingHeroesFusion: parseInt(res[1].toString(), 10),
    };
  }

  async getProcessableTokens(user: string): Promise<string> {
    return (await this.mainRead().getFunction("getProcessableTokens")(user)).toString();
  }

  async hasPendingRandomization(heroId: number): Promise<boolean> {
    return await this.mainRead().getFunction("hasPendingRandomization")(heroId);
  }

  // ── writes ──
  // NOTE: estimateGas uses (user) but the real tx drops it (contract.claim() takes
  // no arg) — preserved from the client.
  async claim(user: string): Promise<boolean> {
    try {
      await this.ctx.send(this.mainWrite(), "claim", [], { estimateArgs: [user] });
      return true;
    } catch {
      return false;
    }
  }

  async mint(user: string, count: number, category: number): Promise<boolean> {
    try {
      const cost = await this.getHeroPrice(category);
      const countBN = toBigInt(count);
      const costBN = toBigInt(cost);
      // Always paid in BCOIN regardless of category (client behaviour).
      await this.bcoin.checkAllowance(user, this.address, costBN * countBN);
      await this.ctx.send(this.mainWrite(), "mint", [count, category]);
      return true;
    } catch {
      return false;
    }
  }

  async upgrade(user: string, baseId: number, materialId: number): Promise<boolean> {
    try {
      // Hardcoded rarity 5 / level 3, ×5 multiplier, paid in BCOIN (client).
      const cost = await this.getUpgradeCost(5, 3);
      const costBN = toBigInt(cost) * HERO_S_PRICE_MULTIPLIER;
      await this.bcoin.checkAllowance(user, this.address, costBN);
      await this.ctx.send(this.mainWrite(), "upgrade", [baseId, materialId]);
      return true;
    } catch {
      return false;
    }
  }

  async randomizeAbilities(user: string, heroId: number): Promise<boolean> {
    try {
      // Hardcoded rarity 5 / times 10, ×5 multiplier, paid in BCOIN (client).
      const cost = await this.getRandomizeAbilityCost(5, 10);
      const costBN = toBigInt(cost) * HERO_S_PRICE_MULTIPLIER;
      await this.bcoin.checkAllowance(user, this.address, costBN);
      await this.ctx.send(this.mainWrite(), "randomizeAbilities", [heroId]);
      return true;
    } catch {
      return false;
    }
  }

  async processRandomizeAbilities(heroId: number): Promise<boolean> {
    try {
      await this.ctx.send(this.mainWrite(), "processRandomizeAbilities", [heroId]);
      return true;
    } catch {
      return false;
    }
  }

  async processTokenRequests(): Promise<{ result: boolean; fusionFailAmount: number; fusionSuccessHeroIds: number[] }> {
    try {
      await this.ctx.send(this.mainWrite(), "processTokenRequests", []);
      return { result: true, fusionFailAmount: 0, fusionSuccessHeroIds: [] };
    } catch {
      return { result: false, fusionFailAmount: 0, fusionSuccessHeroIds: [] };
    }
  }

  // Hero-token claim finaliser (used by ClaimManager for Hero tokenType). Polls
  // until the on-chain processable count matches the pending count, then sends
  // processTokenRequests and (if any) awaits the fusion result events.
  async processTokenRequestsV2(
    user: string,
  ): Promise<{ result: boolean; fusionFailAmount: number; fusionSuccessHeroIds: number[] }> {
    try {
      let pendingHeroesFusion = 0;
      let polls = 0;
      for (;;) {
        const processable = parseInt(await this.getProcessableTokens(user), 10);
        const pending = await this.getPendingTokensV2(user);
        pendingHeroesFusion = pending.pendingHeroesFusion;
        if (processable === pending.pendingHeroes) break;
        if (++polls >= MAX_PROCESS_POLLS) break;
        await sleep(POLL_INTERVAL_MS);
      }

      const contract = this.mainWrite();
      const fusionTask = this.listenToFusionEvents(pendingHeroesFusion, contract, user);
      await this.ctx.send(contract, "processTokenRequests", []);
      const fusion = await fusionTask;
      return {
        result: true,
        fusionFailAmount: fusion.fusionFailAmount,
        fusionSuccessHeroIds: fusion.fusionSuccessHeroIds,
      };
    } catch {
      return { result: false, fusionFailAmount: 0, fusionSuccessHeroIds: [] };
    }
  }

  private async listenToFusionEvents(
    totalFusionAmount: number,
    contract: Contract,
    wallet: string,
  ): Promise<{ fusionFailAmount: number; fusionSuccessAmount: number; fusionSuccessHeroIds: number[] }> {
    if (totalFusionAmount === 0) {
      return { fusionFailAmount: 0, fusionSuccessAmount: 0, fusionSuccessHeroIds: [] };
    }
    return await new Promise((resolve) => {
      let failAmount = 0;
      let successAmount = 0;
      const successIds: number[] = [];
      const done = () => {
        if (failAmount + successAmount >= totalFusionAmount) {
          void contract.off("FusionSuccess", onSuccess);
          void contract.off("FusionFailed", onFailed);
          resolve({ fusionFailAmount: failAmount, fusionSuccessAmount: successAmount, fusionSuccessHeroIds: successIds });
        }
      };
      // FusionSuccess(indexed address user, uint256 count, uint256[] ids, uint256).
      // ethers passes all ABI args (indexed first) then the event payload, so the
      // id array is the 3rd positional arg.
      const onSuccess = (...args: unknown[]) => {
        const ids = args[2] as ArrayLike<unknown> | undefined;
        if (ids) for (const id of Array.from(ids, (v) => Number(v))) if (id) successIds.push(id);
        successAmount += 1;
        done();
      };
      const onFailed = () => {
        failAmount += 1;
        done();
      };
      void contract.on(contract.filters.FusionSuccess(wallet), onSuccess);
      void contract.on(contract.filters.FusionFailed(wallet), onFailed);
    });
  }
}
