// BHeroStake treasury service. The one thing that makes this different from every other treasury
// module: the contract's token balance is mostly staker principal, and only `withdrawFeeAmountsV2`
// may be distributed. Everything here reads and shows that boundary, because the contract reverts
// with "Exceeds fee" rather than silently taking less.
//
// The USDT that comes back from the dev leg is credited to the same ledger by the contract, which is
// what makes it withdrawable through the existing withdrawUnstakeFeeV2 path.
import {Contract, ZeroAddress, formatUnits, parseUnits} from "ethers";
import {ALGEBRA_SWAP_ROUTER, QUICKSWAP_V2_ROUTER} from "../treasury/config";
import {readProvider, walletSigner} from "../treasury/wallet";
import {ERC20_ABI, type Quote} from "../treasury/types";
import {buildPolygonCalldata, quotePolygon} from "../treasury/polygonSwap";
import {SMART_ROUTER, buildSmartRouterCalldata, quoteBsc} from "../treasury/bscSwap";
import {swapGasLimit} from "../treasury/gas";
import {computeLegs, readSplitterView, type Legs, type SourceSplit, type SplitterView} from "../treasury/splitter";
import {BSC_CHAIN_ID, type HeroStakeInstance, type SwapRoute} from "./config";

export {computeLegs};
export type {Legs, SourceSplit};

const HERO_STAKE_ABI = [
    "function treasurySplitter() view returns (address)",
    "function withdrawFeeAmountsV2(address) view returns (uint256)",
    "function withdrawToTreasury(address token, uint256 amount, address router, bytes swapCalldata, uint256 minUsdtOut) returns (uint256)",
    "function withdrawUnstakeFeeV2(address token, address receiver, uint256 amount)",
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

export interface HeroStakeInfo extends SplitterView {
    // Everything the contract holds of this route's token, principal included.
    balance: bigint;
    // The distributable part. The rest is staker principal and the contract refuses to touch it.
    feeLedger: bigint;
    decimalsIn: number;
    contractUsdt: bigint;
    usdtLedger: bigint;
    decimalsUsdt: number;
    splitter: string | null;
}

export async function readHeroStakeInfo(instance: HeroStakeInstance, route: SwapRoute): Promise<HeroStakeInfo> {
    const p = readProvider(instance.chainId);
    const contract = new Contract(instance.address, HERO_STAKE_ABI, p);
    const tokenIn = new Contract(route.tokenIn, ERC20_ABI, p);
    const usdt = new Contract(route.tokenOut, ERC20_ABI, p);

    const [balance, decIn, contractUsdt, decUsdt, feeLedger, usdtLedger, splitterAddr] = await Promise.all([
        tokenIn.balanceOf(instance.address),
        tokenIn.decimals(),
        usdt.balanceOf(instance.address),
        usdt.decimals(),
        contract.withdrawFeeAmountsV2(route.tokenIn),
        contract.withdrawFeeAmountsV2(route.tokenOut),
        contract.treasurySplitter(),
    ]);

    const base = {
        balance,
        feeLedger,
        decimalsIn: Number(decIn),
        contractUsdt,
        usdtLedger,
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

// Quote the dev leg only. Also re-checks the ledger, so an over-sized amount is reported here rather
// than as a bare "Exceeds fee" revert after the user has already signed.
export async function quoteHeroStakeDistribution(
    route: SwapRoute,
    humanAmount: string,
    slippageBps: number,
    split: SourceSplit,
    decimalsIn: number,
    feeLedger: bigint,
): Promise<{legs: Legs; quote: Quote | null}> {
    const amount = parseUnits(humanAmount, decimalsIn);
    if (amount <= 0n) throw new Error("Số lượng phải > 0");
    if (amount > feeLedger) {
        throw new Error(
            `Vượt sổ phí: tối đa ${formatUnits(feeLedger, decimalsIn)}, phần còn lại là tiền gốc của staker`,
        );
    }
    const legs = computeLegs(amount, split);
    if (split.devBps === 0) return {legs, quote: null};
    return {legs, quote: await quote(route, formatUnits(legs.dev, decimalsIn), slippageBps)};
}

export async function distributeHeroStakeFees(
    instance: HeroStakeInstance,
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
    const contract = new Contract(instance.address, HERO_STAKE_ABI, signer);
    const args = [route.tokenIn, amount, router, calldata, minOut];
    const tx = await contract.withdrawToTreasury(...args, {gasLimit: await swapGasLimit(contract.withdrawToTreasury, args)});
    await tx.wait();
    return tx.hash;
}

export async function readHeroStakeUsdt(
    instance: HeroStakeInstance,
    usdtAddress: string,
): Promise<{balance: bigint; ledger: bigint; decimals: number}> {
    const p = readProvider(instance.chainId);
    const token = new Contract(usdtAddress, ERC20_ABI, p);
    const contract = new Contract(instance.address, HERO_STAKE_ABI, p);
    const [balance, decimals, ledger] = await Promise.all([
        token.balanceOf(instance.address),
        token.decimals(),
        contract.withdrawFeeAmountsV2(usdtAddress),
    ]);
    return {balance, ledger, decimals: Number(decimals)};
}

// withdrawUnstakeFeeV2 decrements the ledger before transferring, so it can only ever pay out what
// was booked as fee — never principal, and never more USDT than the distributions credited.
export async function withdrawHeroStakeFee(
    instance: HeroStakeInstance,
    tokenAddress: string,
    receiver: string,
    amount: bigint,
): Promise<string> {
    const signer = await walletSigner(instance.chainId);
    const contract = new Contract(instance.address, HERO_STAKE_ABI, signer);
    const tx = await contract.withdrawUnstakeFeeV2(tokenAddress, receiver, amount);
    await tx.wait();
    return tx.hash;
}
