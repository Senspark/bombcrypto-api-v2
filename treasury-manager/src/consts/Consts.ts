export const BSC_CHAIN_ID = 56;
export const POLYGON_CHAIN_ID = 137;

export type RouteKind = "v2" | "algebra" | "smart";

export interface TreasuryInstance {
    id: string;
    label: string;
    chainId: number;
    address: string;
}

export interface SwapRoute {
    id: string;
    chainId: number;
    label: string;
    kind: RouteKind;
    tokenIn: string;
    tokenInSymbol: string;
    tokenOut: string;
    tokenOutSymbol: string;
}

// Markets only. BHeroS was dropped when its proxy lost swapToUSDT in favour of the treasury
// splitter — it is driven from the BHeroS tab's withdrawToTreasury button, not from here.
export const INSTANCES: TreasuryInstance[] = [
    {id: "bhero-bsc", label: "BHeroMarket", chainId: BSC_CHAIN_ID, address: "0x376A10E7f125A4E0a567cc08043c695Cd8EDd704"},
    {id: "bhero-polygon", label: "BHeroMarket", chainId: POLYGON_CHAIN_ID, address: "0xf3a7195920519f8a22cdf84ebb9f74342abe9812"},
    {id: "bhouse-bsc", label: "BHouseMarket", chainId: BSC_CHAIN_ID, address: "0x049896f350C802CD5C91134E5f35Ec55FA8f0108"},
    {id: "bhouse-polygon", label: "BHouseMarket", chainId: POLYGON_CHAIN_ID, address: "0xbb5966daf83ec4d3f168671a464eb18430eea3be"},
];

export const POLYGON_USDT = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
export const BSC_USDT = "0x55d398326f99059fF775485246999027B3197955";

export const QUICKSWAP_V2_ROUTER = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";
export const ALGEBRA_SWAP_ROUTER = "0xf5b509bB0909a69B1c207E495f687a596C168E12";
export const ALGEBRA_QUOTER = "0xa15F0D7377B2A0C0c10db057f641beD21028FC89";
export const PANCAKE_SMART_ROUTER = "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4";

export const ROUTES: SwapRoute[] = [
    {id: "poly-bomb", chainId: POLYGON_CHAIN_ID, label: "BOMB -> USDT (QuickSwap V2)", kind: "v2",
     tokenIn: "0xB2C63830D4478cB331142FAc075A39671a5541dC", tokenInSymbol: "BOMB", tokenOut: POLYGON_USDT, tokenOutSymbol: "USDT"},
    {id: "poly-sen", chainId: POLYGON_CHAIN_ID, label: "SEN -> USDT (QuickSwap V3 / Algebra)", kind: "algebra",
     tokenIn: "0xFe302B8666539d5046cd9aA0707bB327F5f94C22", tokenInSymbol: "SEN", tokenOut: POLYGON_USDT, tokenOutSymbol: "USDT"},
    {id: "bsc-bcoin", chainId: BSC_CHAIN_ID, label: "BCOIN -> USDT (PancakeSwap SmartRouter)", kind: "smart",
     tokenIn: "0x00e1656e45f18ec6747F5a8496Fd39B50b38396D", tokenInSymbol: "BCOIN", tokenOut: BSC_USDT, tokenOutSymbol: "USDT"},
    {id: "bsc-sen", chainId: BSC_CHAIN_ID, label: "SEN -> USDT (PancakeSwap SmartRouter)", kind: "smart",
     tokenIn: "0xb43Ac9a81eDA5a5b36839d5b6FC65606815361b0", tokenInSymbol: "SEN", tokenOut: BSC_USDT, tokenOutSymbol: "USDT"},
];

export const CHAINS: Record<number, {name: string; explorerTx: string}> = {
    [BSC_CHAIN_ID]: {name: "BSC", explorerTx: "https://bscscan.com/tx/"},
    [POLYGON_CHAIN_ID]: {name: "Polygon", explorerTx: "https://polygonscan.com/tx/"},
};

export function findInstance(id: string): TreasuryInstance | undefined {
    return INSTANCES.find((i) => i.id === id);
}

export function findRoute(id: string): SwapRoute | undefined {
    return ROUTES.find((r) => r.id === id);
}

export function routerOf(route: SwapRoute): string {
    if (route.kind === "v2") return QUICKSWAP_V2_ROUTER;
    if (route.kind === "algebra") return ALGEBRA_SWAP_ROUTER;
    return PANCAKE_SMART_ROUTER;
}

export function scheduleIdOf(instanceId: string, routeId: string): string {
    return `${instanceId}:${routeId}`;
}

// A schedule only makes sense where the token lives on the same chain as the contract.
export function isValidPair(instance: TreasuryInstance, route: SwapRoute): boolean {
    return instance.chainId === route.chainId;
}

export const ERC20_ABI = [
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
];

// swapToUSDT and the preflight getters are identical across BHeroMarket and BHouseMarket.
export const TREASURY_ABI = [
    "function swapRouterAllowed(address) view returns (bool)",
    "function usdtToken() view returns (address)",
    "function swapToUSDT(address tokenIn, uint256 amountIn, address router, bytes swapCalldata, uint256 minUsdtOut)",
];

export const RedisKeys = {
    SCHEDULE_IDS: "AP_TREASURY:SCHEDULE:IDS",
    CONFIG_PREFIX: "AP_TREASURY:CONFIG:",
    STATE_PREFIX: "AP_TREASURY:STATE:",
    RUNS_PREFIX: "AP_TREASURY:RUNS:",
    SESSION_PREFIX: "AP_TREASURY:SESSION:",
    LOCK_PREFIX: "AP_TREASURY:LOCK:",
};

export const RUN_HISTORY_LIMIT = 50;

export const ClientErrors = {
    UNAUTHORIZED: "Please sign in to continue.",
    FORBIDDEN_DOMAIN: "This account is not allowed.",
    INVALID_CREDENTIAL: "Sign-in failed. Please try again.",
    INTERNAL: "Unable to process your request right now. Please try again later.",
    NOT_FOUND: "Schedule not found.",
};
