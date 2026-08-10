// Market treasury config: which contract instances exist, reusing token/router/USDT setup from
// the DepositBridge treasury module (same tokens, same routers on each chain — see market-swap-plan.md).
import {BSC_CHAIN_ID, CHAINS, POLYGON_CHAIN_ID, ROUTES, type SwapRoute} from "../treasury/config";

export {BSC_CHAIN_ID, CHAINS, POLYGON_CHAIN_ID, ROUTES};
export type {SwapRoute};

export interface MarketInstance {
    id: string;
    label: string; // "BHeroMarket" | "BHouseMarket"
    chainId: number;
    address: string;
}

// Proxy addresses from docs/contract/swap-fee/market-swap-plan.md (already upgraded + configured
// with swapToUSDT / setSwapRouter / setUsdtToken on both chains).
export const MARKETS: MarketInstance[] = [
    {id: "bhero-bsc", label: "BHeroMarket", chainId: BSC_CHAIN_ID, address: "0x376A10E7f125A4E0a567cc08043c695Cd8EDd704"},
    {id: "bhero-polygon", label: "BHeroMarket", chainId: POLYGON_CHAIN_ID, address: "0xf3a7195920519f8a22cdf84ebb9f74342abe9812"},
    {id: "bhouse-bsc", label: "BHouseMarket", chainId: BSC_CHAIN_ID, address: "0x049896f350C802CD5C91134E5f35Ec55FA8f0108"},
    {id: "bhouse-polygon", label: "BHouseMarket", chainId: POLYGON_CHAIN_ID, address: "0xbb5966daf83ec4d3f168671a464eb18430eea3be"},
];

// Fee tokens a market can hold, per chain — same whitelist-able tokens as the bridge (BCOIN/SEN).
export function routesFor(market: MarketInstance): SwapRoute[] {
    return ROUTES.filter((r) => r.chainId === market.chainId);
}
