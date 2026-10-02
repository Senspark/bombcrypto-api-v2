// BHeroS treasury service: read fee balance / USDT balance and trigger withdrawToTreasury /
// withdrawCustomToken. Same "whole balance is already free to distribute" property as Market —
// BHeroS is a pure sale contract (mint() pulls bcoinToken via transferFrom), no escrow/refund
// bookkeeping. No swap here any more: the dev leg is transferred to TreasuryDev and converted there.
// Note: BHeroS has no withdrawV2(token) — withdrawCustomToken(token) is the sweep-any-token
// equivalent (its plain withdraw() sweeps bcoinToken+senToken together with no param, unrelated here).
import {Contract, ZeroAddress, parseUnits} from "ethers";
import {readProvider, walletSigner} from "../treasury/wallet";
import {ERC20_ABI} from "../treasury/types";
import {swapGasLimit} from "../treasury/gas";
import {computeLegs, readSplitterView, type Legs, type SourceSplit, type SplitterView} from "../treasury/splitter";
import {type BHeroSInstance, type SwapRoute} from "./config";

export {computeLegs};
export type {Legs, SourceSplit};

const BHEROS_ABI = [
    "function withdrawCustomToken(address value)",
    "function treasurySplitter() view returns (address)",
    "function withdrawToTreasury(address token, uint256 amount, address router, bytes swapCalldata, uint256 minUsdtOut) returns (uint256)",
    "function withdrawNative(address to, uint256 amount)",
];

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
    };
    if (splitterAddr === ZeroAddress) return base;

    const view = await readSplitterView(instance.chainId, splitterAddr, instance.address, route.tokenIn);
    return {...base, splitter: splitterAddr, ...view};
}

// Pure arithmetic — the legs are transfers, so there is no price to look up.
export function previewBHeroSDistribution(humanAmount: string, split: SourceSplit, decimalsIn: number): Legs {
    const amount = parseUnits(humanAmount, decimalsIn);
    if (amount <= 0n) throw new Error("Số lượng phải > 0");
    return computeLegs(amount, split);
}

// One transaction, four legs, all of them transfers of the fee token. The last three arguments are
// the splitter's dead swap parameters, kept in the signature so the proxy needed no upgrade.
export async function distributeBHeroSFees(
    instance: BHeroSInstance,
    route: SwapRoute,
    humanAmount: string,
    decimalsIn: number,
): Promise<string> {
    const amount = parseUnits(humanAmount, decimalsIn);

    const signer = await walletSigner(instance.chainId);
    const contract = new Contract(instance.address, BHEROS_ABI, signer);
    const args = [route.tokenIn, amount, ZeroAddress, "0x", 0n];
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

// --- native (BNB / POL) from upgradeHero / resetSkill / resetSkin ---

export async function readBHeroSNativeBalance(instance: BHeroSInstance): Promise<bigint> {
    return readProvider(instance.chainId).getBalance(instance.address);
}

// withdrawNative takes explicit to/amount. The whole balance is sale proceeds, so any amount up to it is free to take.
export async function withdrawBHeroSNative(instance: BHeroSInstance, to: string, amount: bigint): Promise<string> {
    const signer = await walletSigner(instance.chainId);
    const contract = new Contract(instance.address, BHEROS_ABI, signer);
    const tx = await contract.withdrawNative(to, amount);
    await tx.wait();
    return tx.hash;
}
