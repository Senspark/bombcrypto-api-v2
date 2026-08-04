// Treasury service: read collectedFees / USDT balance, quote (dispatch by chain), and trigger the
// DepositBridge functions. The route/calldata are built off-chain with recipient = the bridge; the
// contract enforces the guardrails.
import {Contract} from "ethers";
import {ALGEBRA_SWAP_ROUTER, BRIDGES, BSC_CHAIN_ID, QUICKSWAP_V2_ROUTER, type SwapRoute} from "./config";
import {readProvider, walletSigner} from "./wallet";
import {ERC20_ABI, type Quote, type TreasuryInfo} from "./types";
import {buildPolygonCalldata, quotePolygon} from "./polygonSwap";
import {SMART_ROUTER, buildSmartRouterCalldata, quoteBsc} from "./bscSwap";

const BRIDGE_ABI = [
    "function collectedFees(address) view returns (uint256)",
    "function usdtToken() view returns (address)",
    "function swapRouterAllowed(address) view returns (bool)",
    "function swapFeesToUSDT(address tokenIn, uint256 amountIn, address router, bytes swapCalldata, uint256 minUsdtOut)",
    "function withdrawTreasuryUsdt(address to, uint256 amount)",
];

function isBsc(route: SwapRoute): boolean {
    return route.chainId === BSC_CHAIN_ID;
}

function routerOf(route: SwapRoute): string {
    if (route.kind === "v2") return QUICKSWAP_V2_ROUTER;
    if (route.kind === "algebra") return ALGEBRA_SWAP_ROUTER;
    return SMART_ROUTER;
}

export function quote(route: SwapRoute, humanAmount: string, slippageBps: number): Promise<Quote> {
    return isBsc(route) ? quoteBsc(route, humanAmount, slippageBps) : quotePolygon(route, humanAmount, slippageBps);
}

export async function readTreasury(route: SwapRoute): Promise<TreasuryInfo> {
    const p = readProvider(route.chainId);
    const bridgeAddr = BRIDGES[route.chainId];
    const bridge = new Contract(bridgeAddr, BRIDGE_ABI, p);
    const tokenIn = new Contract(route.tokenIn, ERC20_ABI, p);
    const usdt = new Contract(route.tokenOut, ERC20_ABI, p);

    const [fees, decIn, usdtBal, decUsdt, configuredUsdt, routerAllowed] = await Promise.all([
        bridge.collectedFees(route.tokenIn),
        tokenIn.decimals(),
        usdt.balanceOf(bridgeAddr),
        usdt.decimals(),
        bridge.usdtToken(),
        bridge.swapRouterAllowed(routerOf(route)),
    ]);

    return {
        fees,
        decimalsIn: Number(decIn),
        usdt: usdtBal,
        decimalsUsdt: Number(decUsdt),
        usdtConfigured: configuredUsdt.toLowerCase() === route.tokenOut.toLowerCase(),
        routerAllowed,
    };
}

export async function readUsdtBalance(chainId: number, usdtAddress: string): Promise<{usdt: bigint; decimals: number}> {
    const p = readProvider(chainId);
    const c = new Contract(usdtAddress, ERC20_ABI, p);
    const [usdt, decimals] = await Promise.all([c.balanceOf(BRIDGES[chainId]), c.decimals()]);
    return {usdt, decimals: Number(decimals)};
}

// Quote off-chain, encode the router call with recipient = bridge, then let the manager wallet trigger
// DepositBridge.swapFeesToUSDT. minUsdtOut passed to the contract matches the quote's slippage bound.
export async function swapFees(route: SwapRoute, humanAmount: string, slippageBps: number): Promise<string> {
    const bridgeAddr = BRIDGES[route.chainId];
    const q = await quote(route, humanAmount, slippageBps);
    const {router, calldata} = isBsc(route)
        ? buildSmartRouterCalldata(q.trade, bridgeAddr, slippageBps)
        : buildPolygonCalldata(route, q.amountIn, q.minOut, bridgeAddr);

    const signer = await walletSigner(route.chainId);
    const bridge = new Contract(bridgeAddr, BRIDGE_ABI, signer);
    const tx = await bridge.swapFeesToUSDT(route.tokenIn, q.amountIn, router, calldata, q.minOut);
    await tx.wait();
    return tx.hash;
}

export async function withdrawUsdt(chainId: number, to: string, amount: bigint): Promise<string> {
    const signer = await walletSigner(chainId);
    const bridge = new Contract(BRIDGES[chainId], BRIDGE_ABI, signer);
    const tx = await bridge.withdrawTreasuryUsdt(to, amount);
    await tx.wait();
    return tx.hash;
}
