import {SwapRoute, TreasuryInstance} from "../consts/Consts.js";

export interface Quote {
    amountIn: bigint;
    expectedOut: bigint;
    minOut: bigint;
    decimalsIn: number;
    decimalsOut: number;
    slippageBps: number;
    routeLabel?: string;
    /** SmartRouterTrade on BSC. Live object graph, not serializable — never leaves the process. */
    trade?: unknown;
}

export interface SwapResult {
    txHash: string;
    amountIn: bigint;
    expectedOut: bigint;
    minOut: bigint;
    decimalsIn: number;
    decimalsOut: number;
}

export interface TreasuryReading {
    fees: bigint;
    decimalsIn: number;
    usdt: bigint;
    decimalsUsdt: number;
    usdtConfigured: boolean;
    routerAllowed: boolean;
}

export default interface ISwapExecutor {
    read(instance: TreasuryInstance, route: SwapRoute): Promise<TreasuryReading>;
    /** Price-only, no transaction. Used to validate a route before committing gas to it. */
    quote(route: SwapRoute, amountHuman: string, slippageBps: number): Promise<Quote>;
    execute(instance: TreasuryInstance, route: SwapRoute, amountHuman: string, slippageBps: number): Promise<SwapResult>;
}
