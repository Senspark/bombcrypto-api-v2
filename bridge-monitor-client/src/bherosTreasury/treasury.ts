// BHeroS treasury service: read fee balance / USDT balance, quote (dispatch by chain — reuses the
// bridge's quote+calldata builders as-is, they're contract-agnostic), and trigger swapToUSDT /
// withdrawCustomToken. Same "whole balance is already free to swap" property as Market — BHeroS is
// a pure sale contract (mint() pulls bcoinToken via transferFrom), no escrow/refund bookkeeping.
// Note: BHeroS has no withdrawV2(token) — withdrawCustomToken(token) is the sweep-any-token
// equivalent (its plain withdraw() sweeps bcoinToken+senToken together with no param, unrelated here).
import {Contract} from "ethers";
import {ALGEBRA_SWAP_ROUTER, QUICKSWAP_V2_ROUTER} from "../treasury/config";
import {readProvider, walletSigner} from "../treasury/wallet";
import {ERC20_ABI, type Quote, type TreasuryInfo} from "../treasury/types";
import {buildPolygonCalldata, quotePolygon} from "../treasury/polygonSwap";
import {SMART_ROUTER, buildSmartRouterCalldata, quoteBsc} from "../treasury/bscSwap";
import {swapGasLimit} from "../treasury/gas";
import {BSC_CHAIN_ID, type BHeroSInstance, type SwapRoute} from "./config";

const BHEROS_ABI = [
    "function swapRouterAllowed(address) view returns (bool)",
    "function usdtToken() view returns (address)",
    "function swapToUSDT(address tokenIn, uint256 amountIn, address router, bytes swapCalldata, uint256 minUsdtOut)",
    "function withdrawCustomToken(address value)",
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

export async function readBHeroSTreasury(instance: BHeroSInstance, route: SwapRoute): Promise<TreasuryInfo> {
    const p = readProvider(instance.chainId);
    const contract = new Contract(instance.address, BHEROS_ABI, p);
    const tokenIn = new Contract(route.tokenIn, ERC20_ABI, p);
    const usdt = new Contract(route.tokenOut, ERC20_ABI, p);

    const [fees, decIn, usdtBal, decUsdt, configuredUsdt, routerAllowed] = await Promise.all([
        tokenIn.balanceOf(instance.address),
        tokenIn.decimals(),
        usdt.balanceOf(instance.address),
        usdt.decimals(),
        contract.usdtToken(),
        contract.swapRouterAllowed(routerOf(route)),
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

export async function readBHeroSUsdtBalance(instance: BHeroSInstance, usdtAddress: string): Promise<{usdt: bigint; decimals: number}> {
    const p = readProvider(instance.chainId);
    const c = new Contract(usdtAddress, ERC20_ABI, p);
    const [usdt, decimals] = await Promise.all([c.balanceOf(instance.address), c.decimals()]);
    return {usdt, decimals: Number(decimals)};
}

// Quote off-chain, encode the router call with recipient = the BHeroS contract, then let the
// manager wallet trigger swapToUSDT. minUsdtOut passed to the contract matches the quote's slippage bound.
export async function swapBHeroSFees(instance: BHeroSInstance, route: SwapRoute, humanAmount: string, slippageBps: number): Promise<string> {
    const q = await quote(route, humanAmount, slippageBps);
    const {router, calldata} = isBsc(route)
        ? buildSmartRouterCalldata(q.trade, instance.address, slippageBps)
        : buildPolygonCalldata(route, q.amountIn, q.minOut, instance.address);

    const signer = await walletSigner(instance.chainId);
    const contract = new Contract(instance.address, BHEROS_ABI, signer);
    const args = [route.tokenIn, q.amountIn, router, calldata, q.minOut];
    const tx = await contract.swapToUSDT(...args, {gasLimit: await swapGasLimit(contract.swapToUSDT, args)});
    await tx.wait();
    return tx.hash;
}

// withdrawCustomToken sweeps the entire balance of `tokenAddress` to the caller — no recipient/amount to pick.
export async function withdrawBHeroSToken(instance: BHeroSInstance, tokenAddress: string): Promise<string> {
    const signer = await walletSigner(instance.chainId);
    const contract = new Contract(instance.address, BHEROS_ABI, signer);
    const tx = await contract.withdrawCustomToken(tokenAddress);
    await tx.wait();
    return tx.hash;
}
