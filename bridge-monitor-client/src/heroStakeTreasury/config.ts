// BHeroStake treasury config. Distinct from stakeTreasury/, which covers BCoinStake and SenStake —
// those have no fee ledger and are out of scope for treasury distribution entirely. BHeroStake is
// the one stake contract that does track unstake fees separately from staker principal.
import {BSC_CHAIN_ID, CHAINS, POLYGON_CHAIN_ID, ROUTES, type SwapRoute} from "../treasury/config";

export {BSC_CHAIN_ID, CHAINS, POLYGON_CHAIN_ID, ROUTES};
export type {SwapRoute};

export interface HeroStakeInstance {
    id: string;
    chainId: number;
    address: string;
    // Whether this proxy has withdrawToTreasury yet. There is no older swap path to fall back on
    // here — BHeroStake never had swapToUSDT — so a false flag means the card shows a notice
    // instead of controls.
    distributes?: boolean;
}

export const HERO_STAKES: HeroStakeInstance[] = [
    {id: "herostake-bsc", chainId: BSC_CHAIN_ID, address: "0x053282c295419E67655a5032A4DA4e3f92D11F17", distributes: true},
    {
        id: "herostake-polygon",
        chainId: POLYGON_CHAIN_ID,
        address: "0x810570aa7e16cf14defd69d4c9796f3c1abe2d13",
        distributes: true,
    },
];

// BHeroStake accepts any token as a stake token; in practice that is BCOIN/BOMB and SEN per chain,
// the same routes the other contracts use.
export function routesFor(instance: HeroStakeInstance): SwapRoute[] {
    return ROUTES.filter((r) => r.chainId === instance.chainId);
}
