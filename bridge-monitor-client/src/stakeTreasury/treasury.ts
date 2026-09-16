// Stake treasury service (BCoinStake / SenStake): read balance / totalStake / USDT balance, quote
// (reuses the bridge's quote+calldata builders as-is, they're contract-agnostic), and trigger
// swapToUSDT / withdrawTokenV2. IMPORTANT — unlike Market, this contract's balance is NOT purely
// fee: it's a mix of staker principal (totalStake), unclaimed reward liability, and the early-
// withdraw fee, with no bookkeeping to separate them. swapToUSDT has no guard against totalStake
// (explicit operator decision, see stake-investigation.md) — the UI surfaces totalStake alongside
// the balance so the operator can judge for themselves before swapping.
import {Contract} from "ethers";
import {ALGEBRA_SWAP_ROUTER, QUICKSWAP_V2_ROUTER} from "../treasury/config";
import {readProvider, walletSigner} from "../treasury/wallet";
import {ERC20_ABI, type Quote} from "../treasury/types";
import {buildPolygonCalldata, quotePolygon} from "../treasury/polygonSwap";
import {SMART_ROUTER, buildSmartRouterCalldata, quoteBsc} from "../treasury/bscSwap";
import {swapGasLimit} from "../treasury/gas";
import {BSC_CHAIN_ID, type StakeInstance, type SwapRoute} from "./config";

const STAKE_ABI = [
    "function swapRouterAllowed(address) view returns (bool)",
    "function usdtToken() view returns (address)",
    "function getTotalStaked() view returns (uint256)",
    "function swapToUSDT(address tokenIn, uint256 amountIn, address router, bytes swapCalldata, uint256 minUsdtOut)",
    "function withdrawTokenV2(address tokenAddress)",
];

export interface StakeTreasuryInfo {
    balance: bigint;
    totalStake: bigint;
    decimalsIn: number;
    usdt: bigint;
    decimalsUsdt: number;
    usdtConfigured: boolean;
    routerAllowed: boolean;
}

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

export async function readStakeTreasury(stake: StakeInstance, route: SwapRoute): Promise<StakeTreasuryInfo> {
    const p = readProvider(stake.chainId);
    const contract = new Contract(stake.address, STAKE_ABI, p);
    const tokenIn = new Contract(route.tokenIn, ERC20_ABI, p);
    const usdt = new Contract(route.tokenOut, ERC20_ABI, p);

    const [balance, totalStake, decIn, usdtBal, decUsdt, configuredUsdt, routerAllowed] = await Promise.all([
        tokenIn.balanceOf(stake.address),
        contract.getTotalStaked(),
        tokenIn.decimals(),
        usdt.balanceOf(stake.address),
        usdt.decimals(),
        contract.usdtToken(),
        contract.swapRouterAllowed(routerOf(route)),
    ]);

    return {
        balance,
        totalStake,
        decimalsIn: Number(decIn),
        usdt: usdtBal,
        decimalsUsdt: Number(decUsdt),
        usdtConfigured: configuredUsdt.toLowerCase() === route.tokenOut.toLowerCase(),
        routerAllowed,
    };
}

export async function readStakeUsdtBalance(stake: StakeInstance, usdtAddress: string): Promise<{usdt: bigint; decimals: number}> {
    const p = readProvider(stake.chainId);
    const c = new Contract(usdtAddress, ERC20_ABI, p);
    const [usdt, decimals] = await Promise.all([c.balanceOf(stake.address), c.decimals()]);
    return {usdt, decimals: Number(decimals)};
}

// Quote off-chain, encode the router call with recipient = the stake contract, then let the
// manager wallet trigger swapToUSDT. minUsdtOut passed to the contract matches the quote's slippage bound.
export async function swapStakeFees(stake: StakeInstance, route: SwapRoute, humanAmount: string, slippageBps: number): Promise<string> {
    const q = await quote(route, humanAmount, slippageBps);
    const {router, calldata} = isBsc(route)
        ? buildSmartRouterCalldata(q.trade, stake.address, slippageBps)
        : buildPolygonCalldata(route, q.amountIn, q.minOut, stake.address);

    const signer = await walletSigner(stake.chainId);
    const contract = new Contract(stake.address, STAKE_ABI, signer);
    const args = [route.tokenIn, q.amountIn, router, calldata, q.minOut];
    const tx = await contract.swapToUSDT(...args, {gasLimit: await swapGasLimit(contract.swapToUSDT, args)});
    await tx.wait();
    return tx.hash;
}

// withdrawTokenV2 sweeps the entire balance of `tokenAddress` to the caller — no recipient/amount to pick.
export async function withdrawStakeToken(stake: StakeInstance, tokenAddress: string): Promise<string> {
    const signer = await walletSigner(stake.chainId);
    const contract = new Contract(stake.address, STAKE_ABI, signer);
    const tx = await contract.withdrawTokenV2(tokenAddress);
    await tx.wait();
    return tx.hash;
}
