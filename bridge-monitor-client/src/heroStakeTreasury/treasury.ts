// BHeroStake treasury service. The one thing that makes this different from every other treasury
// module: the contract's token balance is mostly staker principal, and only `withdrawFeeAmountsV2`
// may be distributed. Everything here reads and shows that boundary, because the contract reverts
// with "Exceeds fee" rather than silently taking less.
//
// The dev leg leaves as the fee token now, so no USDT comes back and the USDT ledger only holds what
// earlier distributions credited before TreasuryDev existed. That balance stays withdrawable.
import {Contract, ZeroAddress, formatUnits, parseUnits} from "ethers";
import {readProvider, walletSigner} from "../treasury/wallet";
import {ERC20_ABI} from "../treasury/types";
import {swapGasLimit} from "../treasury/gas";
import {computeLegs, readSplitterView, type Legs, type SourceSplit, type SplitterView} from "../treasury/splitter";
import {type HeroStakeInstance, type SwapRoute} from "./config";

export {computeLegs};
export type {Legs, SourceSplit};

const HERO_STAKE_ABI = [
    "function treasurySplitter() view returns (address)",
    "function withdrawFeeAmountsV2(address) view returns (uint256)",
    "function withdrawToTreasury(address token, uint256 amount, address router, bytes swapCalldata, uint256 minUsdtOut) returns (uint256)",
    "function withdrawUnstakeFeeV2(address token, address receiver, uint256 amount)",
];

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
    };
    if (splitterAddr === ZeroAddress) return base;

    const view = await readSplitterView(instance.chainId, splitterAddr, instance.address, route.tokenIn);
    return {...base, splitter: splitterAddr, ...view};
}

// Pure arithmetic, plus the ledger check — an over-sized amount is reported here rather than as a
// bare "Exceeds fee" revert after the user has already signed.
export function previewHeroStakeDistribution(
    humanAmount: string,
    split: SourceSplit,
    decimalsIn: number,
    feeLedger: bigint,
): Legs {
    const amount = parseUnits(humanAmount, decimalsIn);
    if (amount <= 0n) throw new Error("Số lượng phải > 0");
    if (amount > feeLedger) {
        throw new Error(
            `Vượt sổ phí: tối đa ${formatUnits(feeLedger, decimalsIn)}, phần còn lại là tiền gốc của staker`,
        );
    }
    return computeLegs(amount, split);
}

// The last three arguments are the splitter's dead swap parameters, kept in the signature so this
// proxy needed no upgrade when the dev leg stopped swapping.
export async function distributeHeroStakeFees(
    instance: HeroStakeInstance,
    route: SwapRoute,
    humanAmount: string,
    decimalsIn: number,
): Promise<string> {
    const amount = parseUnits(humanAmount, decimalsIn);

    const signer = await walletSigner(instance.chainId);
    const contract = new Contract(instance.address, HERO_STAKE_ABI, signer);
    const args = [route.tokenIn, amount, ZeroAddress, "0x", 0n];
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
