export interface Quote {
    amountIn: bigint;
    expectedOut: bigint;
    minOut: bigint;
    decimalsIn: number;
    decimalsOut: number;
    slippageBps: number;
    routeLabel?: string; // human path, e.g. "BCOIN -> BUSD -> USDT"
    trade?: unknown;     // SmartRouterTrade — carried to execute for BSC; opaque to the UI
}

export interface TreasuryInfo {
    fees: bigint;
    decimalsIn: number;
    usdt: bigint;
    decimalsUsdt: number;
    usdtConfigured: boolean;
    routerAllowed: boolean;
}

export const ERC20_ABI = [
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
];
