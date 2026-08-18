// The Treasury Manager tab reads every treasury address off the splitter rather than hardcoding
// them, so a setTreasuries / setDevTreasury run cannot leave the UI pointing at a stale contract.
// Only the splitter itself is pinned here.
import {BSC_CHAIN_ID, CHAINS, POLYGON_CHAIN_ID, ROUTES, type SwapRoute} from "../treasury/config";

export {BSC_CHAIN_ID, CHAINS, POLYGON_CHAIN_ID, ROUTES};
export type {SwapRoute};

export interface ChainTreasuries {
    id: string;
    chainId: number;
    splitter: string;
}

export const SPLITTERS: ChainTreasuries[] = [
    {id: "treasuries-bsc", chainId: BSC_CHAIN_ID, splitter: "0x49F4771a0F4C5a6dD4fcD2CB58e1Ad0761a2Ba37"},
    {id: "treasuries-polygon", chainId: POLYGON_CHAIN_ID, splitter: "0x2a1339628981979b40f593E5377CACD3FC32FfD5"},
];

export interface TokenRef {
    address: string;
    symbol: string;
    burnable: boolean; // USDT has no burn(uint256); the fee tokens do
}

// Fee tokens come from the swap routes, so this list follows whatever the treasuries can receive.
export function tokensFor(chainId: number): TokenRef[] {
    const routes = ROUTES.filter((r) => r.chainId === chainId);
    const fees = routes.map((r) => ({address: r.tokenIn, symbol: r.tokenInSymbol, burnable: true}));
    const usdt = routes[0];
    return [...fees, {address: usdt.tokenOut, symbol: usdt.tokenOutSymbol, burnable: false}];
}
