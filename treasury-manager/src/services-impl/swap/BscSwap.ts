import {Contract, parseUnits} from "ethers";
import type {Address} from "viem";
import {ChainId, CurrencyAmount, Percent, Token, TradeType} from "@pancakeswap/sdk";
import {PoolType, SmartRouter, SwapRouter} from "@pancakeswap/smart-router";
import {ERC20_ABI, PANCAKE_SMART_ROUTER, SwapRoute} from "../../consts/Consts.js";
import {Quote} from "../../services/ISwapExecutor.js";
import ChainClients from "../ChainClients.js";

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

export async function quoteBsc(
    clients: ChainClients,
    route: SwapRoute,
    humanAmount: string,
    slippageBps: number,
): Promise<Quote> {
    const provider = clients.provider(route.chainId);
    const client = clients.bscPublicClient();
    const onChainProvider = () => client;
    const quoteProvider = SmartRouter.createQuoteProvider({onChainProvider});

    const [decIn, decOut] = await Promise.all([
        new Contract(route.tokenIn, ERC20_ABI, provider).decimals(),
        new Contract(route.tokenOut, ERC20_ABI, provider).decimals(),
    ]);
    const decimalsIn = Number(decIn);
    const decimalsOut = Number(decOut);

    const tokenIn = new Token(ChainId.BSC, route.tokenIn as Address, decimalsIn, route.tokenInSymbol);
    const tokenOut = new Token(ChainId.BSC, route.tokenOut as Address, decimalsOut, route.tokenOutSymbol);

    const amountIn = parseUnits(humanAmount, decimalsIn);
    if (amountIn <= 0n) throw new Error("amount must be greater than zero");
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
    if (!trade) throw new Error(`no route found for ${route.tokenInSymbol} -> ${route.tokenOutSymbol}`);

    const expectedOut = BigInt(trade.outputAmount.quotient.toString());
    const minOut = (expectedOut * BigInt(10000 - slippageBps)) / 10000n;
    return {amountIn, expectedOut, minOut, decimalsIn, decimalsOut, slippageBps, routeLabel: describeTrade(trade), trade};
}

// recipient is the treasury contract, so the USDT output lands there rather than with the manager wallet.
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
    return {router: PANCAKE_SMART_ROUTER, calldata: calldata as string};
}
