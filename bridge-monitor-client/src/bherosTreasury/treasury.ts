// BHeroS treasury service: read fee balance / USDT balance, quote (dispatch by chain — reuses the
// bridge's quote+calldata builders as-is, they're contract-agnostic), and trigger withdrawToTreasury
// / withdrawCustomToken. Same "whole balance is already free to swap" property as Market — BHeroS is
// a pure sale contract (mint() pulls bcoinToken via transferFrom), no escrow/refund bookkeeping.
// Note: BHeroS has no withdrawV2(token) — withdrawCustomToken(token) is the sweep-any-token
// equivalent (its plain withdraw() sweeps bcoinToken+senToken together with no param, unrelated here).
import {Contract, ZeroAddress, formatUnits, parseUnits} from "ethers";
import {ALGEBRA_SWAP_ROUTER, QUICKSWAP_V2_ROUTER} from "../treasury/config";
import {readProvider, walletSigner} from "../treasury/wallet";
import {ERC20_ABI, type Quote} from "../treasury/types";
import {buildPolygonCalldata, quotePolygon} from "../treasury/polygonSwap";
import {SMART_ROUTER, buildSmartRouterCalldata, quoteBsc} from "../treasury/bscSwap";
import {swapGasLimit} from "../treasury/gas";
import {computeLegs, readSplitterView, type Legs, type SourceSplit, type SplitterView} from "../treasury/splitter";
import {BSC_CHAIN_ID, type BHeroSInstance, type SwapRoute} from "./config";

export {computeLegs};
export type {Legs, SourceSplit};

const BHEROS_ABI = [
    "function withdrawCustomToken(address value)",
    "function treasurySplitter() view returns (address)",
    "function withdrawToTreasury(address token, uint256 amount, address router, bytes swapCalldata, uint256 minUsdtOut) returns (uint256)",
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

export async function readBHeroSUsdtBalance(instance: BHeroSInstance, usdtAddress: string): Promise<{usdt: bigint; decimals: number}> {
    const p = readProvider(instance.chainId);
    const c = new Contract(usdtAddress, ERC20_ABI, p);
    const [usdt, decimals] = await Promise.all([c.balanceOf(instance.address), c.decimals()]);
    return {usdt, decimals: Number(decimals)};
}

// --- four-leg distribution (withdrawToTreasury) ---

export interface BHeroSDistributionInfo extends SplitterView {
    fees: bigint;
    decimalsIn: number;
    contractUsdt: bigint;
    decimalsUsdt: number;
    splitter: string | null; // null when the contract has no splitter wired yet
}

export async function readBHeroSDistribution(
    instance: BHeroSInstance,
    route: SwapRoute,
): Promise<BHeroSDistributionInfo> {
    const p = readProvider(instance.chainId);
    const contract = new Contract(instance.address, BHEROS_ABI, p);
    const tokenIn = new Contract(route.tokenIn, ERC20_ABI, p);
    const usdt = new Contract(route.tokenOut, ERC20_ABI, p);

    const [fees, decIn, contractUsdt, decUsdt, splitterAddr] = await Promise.all([
        tokenIn.balanceOf(instance.address),
        tokenIn.decimals(),
        usdt.balanceOf(instance.address),
        usdt.decimals(),
        contract.treasurySplitter(),
    ]);

    const base = {
        fees,
        decimalsIn: Number(decIn),
        contractUsdt,
        decimalsUsdt: Number(decUsdt),
        splitter: null as string | null,
        split: null,
        treasuries: null,
        balances: null,
        usdtConfigured: false,
        routerAllowed: false,
    };
    if (splitterAddr === ZeroAddress) return base;

    const view = await readSplitterView(
        instance.chainId, splitterAddr, instance.address, routerOf(route), route.tokenIn, route.tokenOut,
    );
    return {...base, splitter: splitterAddr, ...view};
}

// Quote the dev leg only — quoting the full amount would price tokens that never reach a router.
export async function quoteBHeroSDistribution(
    route: SwapRoute,
    humanAmount: string,
    slippageBps: number,
    split: SourceSplit,
    decimalsIn: number,
): Promise<{legs: Legs; quote: Quote | null}> {
    const amount = parseUnits(humanAmount, decimalsIn);
    if (amount <= 0n) throw new Error("Số lượng phải > 0");
    const legs = computeLegs(amount, split);
    if (split.devBps === 0) return {legs, quote: null};
    return {legs, quote: await quote(route, formatUnits(legs.dev, decimalsIn), slippageBps)};
}

// One transaction, four legs. The router calldata's recipient is this contract, so the swapped USDT
// lands back here — that is also how the splitter measures usdtOut.
export async function distributeBHeroSFees(
    instance: BHeroSInstance,
    route: SwapRoute,
    humanAmount: string,
    slippageBps: number,
    split: SourceSplit,
    decimalsIn: number,
): Promise<string> {
    const amount = parseUnits(humanAmount, decimalsIn);
    const legs = computeLegs(amount, split);

    let router = ZeroAddress;
    let calldata = "0x";
    let minOut = 0n;
    if (split.devBps > 0) {
        const q = await quote(route, formatUnits(legs.dev, decimalsIn), slippageBps);
        const built = isBsc(route)
            ? buildSmartRouterCalldata(q.trade, instance.address, slippageBps)
            : buildPolygonCalldata(route, q.amountIn, q.minOut, instance.address);
        router = built.router;
        calldata = built.calldata;
        minOut = q.minOut;
    }

    const signer = await walletSigner(instance.chainId);
    const contract = new Contract(instance.address, BHEROS_ABI, signer);
    const args = [route.tokenIn, amount, router, calldata, minOut];
    const tx = await contract.withdrawToTreasury(...args, {gasLimit: await swapGasLimit(contract.withdrawToTreasury, args)});
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
