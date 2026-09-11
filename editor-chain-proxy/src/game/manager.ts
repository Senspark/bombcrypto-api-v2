import type { GameContext } from "./context";
import { gameContracts } from "./addresses";
import { CoinToken } from "./modules/coinToken";
import { BHero } from "./modules/bhero";
import { BHeroUpgradeV2 } from "./modules/bheroUpgradeV2";
import { BHeroS } from "./modules/bheroS";
import { BHouse } from "./modules/bhouse";
import { Deposit } from "./modules/deposit";
import { ClaimManager } from "./modules/claimManager";
import { HeroStake } from "./modules/heroStake";

// Wires the per-contract modules for one request, mirroring the client's
// ContractManager constructor (module → module dependencies preserved). Built
// lazily per /game call so a bridge-only call never touches the game registry.
export class GameManager {
  readonly bcoin: CoinToken;
  readonly sen: CoinToken;
  readonly bhero: BHero;
  readonly bheroUpgradeV2: BHeroUpgradeV2;
  readonly bheroS: BHeroS;
  readonly bhouse: BHouse;
  readonly deposit: Deposit;
  readonly claimManager: ClaimManager;
  readonly heroStake: HeroStake;

  constructor(ctx: GameContext) {
    const a = gameContracts(ctx.network);
    this.bcoin = new CoinToken(ctx, a.coinToken);
    this.sen = new CoinToken(ctx, a.senToken);
    this.bhero = new BHero(ctx, this.bcoin, a.heroToken);
    this.bheroS = new BHeroS(ctx, this.bcoin, this.bhero, a.heroSToken);
    this.bheroUpgradeV2 = new BHeroUpgradeV2(ctx, this.bcoin, this.sen, a.heroUpgradeV2, a.heroToken);
    this.bhouse = new BHouse(ctx, this.bcoin, a.houseToken);
    this.deposit = new Deposit(ctx, this.bcoin, this.sen, a.deposit);
    this.claimManager = new ClaimManager(ctx, this.bhero, a.claimManager);
    this.heroStake = new HeroStake(ctx, this.bcoin, this.sen, a.heroStake);
  }
}
