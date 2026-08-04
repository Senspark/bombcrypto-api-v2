// BSC quote + calldata for the treasury flow, via PancakeSwap SmartRouter. Candidate pools + quotes
// are fetched purely on-chain through a viem client (no subgraph, no backend).
import {parseUnits} from "ethers";
import {createPublicClient, http, type Address} from "viem";
import {bsc} from "viem/chains";
import {ChainId, CurrencyAmount, Percent, Token, TradeType} from "@pancakeswap/sdk";
import {PoolType, SMART_ROUTER_ADDRESSES, SmartRouter, SwapRouter} from "@pancakeswap/smart-router";
import {BSC_RPC, type SwapRoute} from "./config";
import {readProvider} from "./wallet";
import {ERC20_ABI, type Quote} from "./types";
import {Contract} from "ethers";

export const SMART_ROUTER = SMART_ROUTER_ADDRESSES[ChainId.BSC];

const client = createPublicClient({
    chain: bsc,
    transport: http(BSC_RPC),
    batch: {multicall: {batchSize: 1024 * 200, wait: 16}},
});
const onChainProvider = () => client;
const quoteProvider = SmartRouter.createQuoteProvider({onChainProvider});

type SmartTrade = Parameters<typeof SwapRouter.swapCallParameters>[0];

function describeTrade(trade: {routes: {path: {symbol?: string}[]; percent: number}[]}): string {
    const multi = trade.routes.length > 1;
    return trade.routes
        .map((r) => {
            const path = r.path.map((t) => t.symbol ?? "?").join(" -> ");
            return multi ? `${r.percent}% ${path}` : path;
        })
        .join(" | ");
}

export async function quoteBsc(route: SwapRoute, humanAmount: string, slippageBps: number): Promise<Quote> {
    const p = readProvider(route.chainId);
    const [decIn, decOut] = await Promise.all([
        new Contract(route.tokenIn, ERC20_ABI, p).decimals(),
        new Contract(route.tokenOut, ERC20_ABI, p).decimals(),
    ]);
    const decimalsIn = Number(decIn);
    const decimalsOut = Number(decOut);

    const tokenIn = new Token(ChainId.BSC, route.tokenIn as Address, decimalsIn, route.tokenInSymbol);
    const tokenOut = new Token(ChainId.BSC, route.tokenOut as Address, decimalsOut, route.tokenOutSymbol);

    const amountIn = parseUnits(humanAmount, decimalsIn);
    if (amountIn <= 0n) throw new Error("Số lượng phải > 0");
    const amount = CurrencyAmount.fromRawAmount(tokenIn, amountIn);

    const [v2, v3] = await Promise.all([
        SmartRouter.getV2CandidatePools({onChainProvider, currencyA: tokenIn, currencyB: tokenOut}),
        SmartRouter.getV3CandidatePools({onChainProvider, currencyA: tokenIn, currencyB: tokenOut}),
    ]);

    const trade = await SmartRouter.getBestTrade(amount, tokenOut, TradeType.EXACT_INPUT, {
        gasPriceWei: () => client.getGasPrice(),
        maxHops: 3,
        maxSplits: 2,
        poolProvider: SmartRouter.createStaticPoolProvider([...v2, ...v3]),
        quoteProvider,
        allowedPoolTypes: [PoolType.V2, PoolType.V3],
    });
    if (!trade) throw new Error("Không tìm được route cho cặp này");

    const expectedOut = BigInt(trade.outputAmount.quotient.toString());
    const minOut = (expectedOut * BigInt(10000 - slippageBps)) / 10000n;
    return {
        amountIn, expectedOut, minOut, decimalsIn, decimalsOut, slippageBps,
        routeLabel: describeTrade(trade), trade,
    };
}

// Build SmartRouter calldata with `recipient` = the bridge, for the DepositBridge to low-level-`call`
// inside swapFeesToUSDT. Reuses the trade already computed by quoteBsc.
export function buildSmartRouterCalldata(
    trade: unknown,
    recipient: string,
    slippageBps: number,
): {router: string; calldata: string} {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    const {calldata} = SwapRouter.swapCallParameters(trade as SmartTrade, {
        recipient: recipient as Address,
        slippageTolerance: new Percent(slippageBps, 10000),
        deadlineOrPreviousBlockhash: deadline.toString(),
    });
    return {router: SMART_ROUTER, calldata: calldata as string};
}
