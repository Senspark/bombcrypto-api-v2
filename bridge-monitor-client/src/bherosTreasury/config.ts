// BHeroS treasury config: which contract instances exist, reusing token/router/USDT setup from
// the DepositBridge treasury module (same tokens, same routers on each chain — see
// docs/contract/swap-fee/PENDING.md). Only one instance per chain (unlike Market's 2 labels).
import {BSC_CHAIN_ID, CHAINS, POLYGON_CHAIN_ID, ROUTES, type SwapRoute} from "../treasury/config";

export {BSC_CHAIN_ID, CHAINS, POLYGON_CHAIN_ID, ROUTES};
export type {SwapRoute};

export interface BHeroSInstance {
    id: string;
    chainId: number;
    address: string;
}

// Both chains are upgraded to withdrawToTreasury and have a splitter wired. The old swapToUSDT path
// is gone from the proxy, so there is no per-instance fallback to pick any more.
export const BHEROS: BHeroSInstance[] = [
    {id: "bheros-bsc", chainId: BSC_CHAIN_ID, address: "0x9fb9b7349279266c85c0C9dd264D71d2a4B79AB4"},
    {id: "bheros-polygon", chainId: POLYGON_CHAIN_ID, address: "0x27313635E6B7AA3CC8436E24BE2317D4A0e56BeB"},
];

// Fee tokens BHeroS can hold, per chain — bcoinToken + senToken, same routes as Market.
export function routesFor(instance: BHeroSInstance): SwapRoute[] {
    return ROUTES.filter((r) => r.chainId === instance.chainId);
}
