// Stake treasury config: which contract instances exist, reusing token/router/USDT setup from
// the DepositBridge treasury module (same tokens, same routers on each chain — see
// docs/contract/swap-fee/stake-investigation.md). Unlike Market, each stake contract only ever
// holds ONE token (its own stakingToken), so routeIds pins it instead of matching by chain alone.
import {BSC_CHAIN_ID, CHAINS, POLYGON_CHAIN_ID, ROUTES, type SwapRoute} from "../treasury/config";

export {BSC_CHAIN_ID, CHAINS, POLYGON_CHAIN_ID};
export type {SwapRoute};

export interface StakeInstance {
    id: string;
    label: string; // "BCoinStake" | "SenStake"
    chainId: number;
    address: string;
    routeIds: string[]; // which ROUTES entries this pool's stakingToken matches
}

// Proxy addresses from docs/contract/swap-fee/stake-investigation.md (upgraded + configured with
// swapToUSDT / setSwapRouter / setUsdtToken on both chains, same router-whitelist design as the
// market contracts).
export const STAKES: StakeInstance[] = [
    {id: "bcoin-bsc", label: "BCoinStake", chainId: BSC_CHAIN_ID, address: "0x1cf220128d22b9c272260c6b9ff84eed77dba6f1", routeIds: ["bsc-bcoin"]},
    {id: "bcoin-polygon", label: "BCoinStake", chainId: POLYGON_CHAIN_ID, address: "0x94d4b83161d6d4c5f89d884f3ef569f000cc065f", routeIds: ["poly-bomb"]},
    {id: "sen-bsc", label: "SenStake", chainId: BSC_CHAIN_ID, address: "0x4fd4a6905ef6b0084af1e4912bb81ed41a1bda21", routeIds: ["bsc-sen"]},
    {id: "sen-polygon", label: "SenStake", chainId: POLYGON_CHAIN_ID, address: "0x7fee03e047a7d4e0f99d343624fe650fcd2e9250", routeIds: ["poly-sen"]},
];

export function routesFor(stake: StakeInstance): SwapRoute[] {
    return ROUTES.filter((r) => stake.routeIds.includes(r.id));
}
