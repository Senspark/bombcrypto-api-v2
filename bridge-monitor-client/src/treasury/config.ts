// Treasury fee-swap config. Only addresses/RPCs; token decimals are read on-chain at runtime.
// Verified against the swap-test-client which executed real swaps through exactly these routers.

export const POLYGON_CHAIN_ID = 137;
export const BSC_CHAIN_ID = 56;

// Read RPCs (balances + quotes) are independent of the wallet's current chain. Override via env.
export const POLYGON_RPC = import.meta.env.VITE_POLYGON_RPC || "https://polygon-bor-rpc.publicnode.com";
export const BSC_RPC = import.meta.env.VITE_BSC_RPC || "https://bsc-dataseed.binance.org";

export const POLYGON_USDT = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
export const BSC_USDT = "0x55d398326f99059fF775485246999027B3197955";

// Polygon direct 1-hop routers (called via typed calldata).
export const QUICKSWAP_V2_ROUTER = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"; // BOMB -> USDT
export const ALGEBRA_SWAP_ROUTER = "0xf5b509bB0909a69B1c207E495f687a596C168E12"; // SEN -> USDT (Algebra v1.9)
export const ALGEBRA_QUOTER = "0xa15F0D7377B2A0C0c10db057f641beD21028FC89";

export type RouteKind = "v2" | "algebra" | "smart";

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

// The fee tokens the treasury swaps to USDT, per chain.
export const ROUTES: SwapRoute[] = [
    {
        id: "poly-bomb", chainId: POLYGON_CHAIN_ID, label: "BOMB -> USDT (QuickSwap V2)",
        kind: "v2", tokenIn: "0xB2C63830D4478cB331142FAc075A39671a5541dC", tokenInSymbol: "BOMB",
        tokenOut: POLYGON_USDT, tokenOutSymbol: "USDT",
    },
    {
        id: "poly-sen", chainId: POLYGON_CHAIN_ID, label: "SEN -> USDT (QuickSwap V3 / Algebra)",
        kind: "algebra", tokenIn: "0xFe302B8666539d5046cd9aA0707bB327F5f94C22", tokenInSymbol: "SEN",
        tokenOut: POLYGON_USDT, tokenOutSymbol: "USDT",
    },
    {
        id: "bsc-bcoin", chainId: BSC_CHAIN_ID, label: "BCOIN -> USDT (PancakeSwap SmartRouter)",
        kind: "smart", tokenIn: "0x00e1656e45f18ec6747F5a8496Fd39B50b38396D", tokenInSymbol: "BCOIN",
        tokenOut: BSC_USDT, tokenOutSymbol: "USDT",
    },
    {
        id: "bsc-sen", chainId: BSC_CHAIN_ID, label: "SEN -> USDT (PancakeSwap SmartRouter)",
        kind: "smart", tokenIn: "0xb43Ac9a81eDA5a5b36839d5b6FC65606815361b0", tokenInSymbol: "SEN",
        tokenOut: BSC_USDT, tokenOutSymbol: "USDT",
    },
];

export const CHAINS: Record<number, {name: string; explorerTx: string}> = {
    [POLYGON_CHAIN_ID]: {name: "Polygon", explorerTx: "https://polygonscan.com/tx/"},
    [BSC_CHAIN_ID]: {name: "BSC", explorerTx: "https://bscscan.com/tx/"},
};

// DepositBridge proxy per chain — target of the treasury flow.
export const BRIDGES: Record<number, string> = {
    [POLYGON_CHAIN_ID]: "0xD84E8aCAcE2Bddb2Da8975340E83A165dA51FFc3",
    [BSC_CHAIN_ID]: "0xC6aC72C83f72e7F86B7de91f5733c266Fc4F2273",
};
