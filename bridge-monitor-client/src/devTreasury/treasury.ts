// Treasury Dev service: read what the contract holds, quote a swap and run it, then move the USDT
// out. This is the only treasury that swaps — the other three just hold — and it is deliberately a
// separate click rather than part of a distribution, so the conversion is timed by a person.
import {Contract, parseUnits} from "ethers";
import {ALGEBRA_SWAP_ROUTER, QUICKSWAP_V2_ROUTER} from "../treasury/config";
import {readProvider, walletSigner} from "../treasury/wallet";
import {ERC20_ABI, type Quote} from "../treasury/types";
import {buildPolygonCalldata, quotePolygon} from "../treasury/polygonSwap";
import {SMART_ROUTER, buildSmartRouterCalldata, quoteBsc} from "../treasury/bscSwap";
import {swapGasLimit} from "../treasury/gas";
import {BSC_CHAIN_ID, type DevTreasuryInstance, type SwapRoute} from "./config";

const DEV_ABI = [
    "function usdtToken() view returns (address)",
    "function routerAllowed(address) view returns (bool)",
    "function swapToUSDT(address tokenIn, uint256 amountIn, address router, bytes swapCalldata, uint256 minUsdtOut) returns (uint256)",
    "function withdrawTo(address token, address receiver, uint256 amount)",
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

export interface DevTreasuryInfo {
    fees: bigint;
    decimalsIn: number;
    usdt: bigint;
    decimalsUsdt: number;
    usdtConfigured: boolean;
    routerAllowed: boolean;
}

export async function readDevTreasury(instance: DevTreasuryInstance, route: SwapRoute): Promise<DevTreasuryInfo> {
    const p = readProvider(instance.chainId);
    const contract = new Contract(instance.address, DEV_ABI, p);
    const tokenIn = new Contract(route.tokenIn, ERC20_ABI, p);
    const usdt = new Contract(route.tokenOut, ERC20_ABI, p);

    const [fees, decIn, usdtBal, decUsdt, configuredUsdt, routerAllowed] = await Promise.all([
        tokenIn.balanceOf(instance.address),
        tokenIn.decimals(),
        usdt.balanceOf(instance.address),
        usdt.decimals(),
        contract.usdtToken(),
        contract.routerAllowed(routerOf(route)),
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

// The recipient encoded in the calldata is this contract: the USDT stays here, and that is also how
// swapToUSDT measures usdtOut, so paying anywhere else reverts as "Insufficient USDT out".
export async function swapDevFees(
    instance: DevTreasuryInstance,
    route: SwapRoute,
    humanAmount: string,
    slippageBps: number,
): Promise<string> {
    const q = await quote(route, humanAmount, slippageBps);
    const built = isBsc(route)
        ? buildSmartRouterCalldata(q.trade, instance.address, slippageBps)
        : buildPolygonCalldata(route, q.amountIn, q.minOut, instance.address);

    const signer = await walletSigner(instance.chainId);
    const contract = new Contract(instance.address, DEV_ABI, signer);
    const args = [route.tokenIn, q.amountIn, built.router, built.calldata, q.minOut];
    const tx = await contract.swapToUSDT(...args, {gasLimit: await swapGasLimit(contract.swapToUSDT, args)});
    await tx.wait();
    return tx.hash;
}

export async function readDevTokenBalance(
    instance: DevTreasuryInstance,
    tokenAddress: string,
): Promise<{balance: bigint; decimals: number}> {
    const p = readProvider(instance.chainId);
    const token = new Contract(tokenAddress, ERC20_ABI, p);
    const [balance, decimals] = await Promise.all([token.balanceOf(instance.address), token.decimals()]);
    return {balance, decimals: Number(decimals)};
}

// withdrawTo takes an explicit receiver and amount — unlike the markets' sweep-everything withdrawV2.
export async function withdrawDevToken(
    instance: DevTreasuryInstance,
    tokenAddress: string,
    receiver: string,
    amount: bigint,
): Promise<string> {
    const signer = await walletSigner(instance.chainId);
    const contract = new Contract(instance.address, DEV_ABI, signer);
    const tx = await contract.withdrawTo(tokenAddress, receiver, amount);
    await tx.wait();
    return tx.hash;
}
