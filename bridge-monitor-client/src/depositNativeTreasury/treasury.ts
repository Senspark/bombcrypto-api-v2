// Deposit Native treasury service: read the vault's native balance + deposited/withdrawn
// bookkeeping, and trigger managerWithdraw. No swap/quote here — this contract never holds an
// ERC20 fee, only native currency deposited by users. Balance should track
// totalDeposited - totalWithdrawn; a shortfall means withdrawing anything at all touches money
// still owed to depositors, not surplus (same spirit as StakeCard's totalStake warning).
import {Contract} from "ethers";
import {readProvider, walletSigner} from "../treasury/wallet";
import type {DepositNativeInstance} from "./config";

const DEPOSIT_NATIVE_ABI = [
    "function totalDeposited() view returns (uint256)",
    "function totalWithdrawn() view returns (uint256)",
    "function managerWithdraw(address to, uint256 amount)",
];

export interface DepositNativeInfo {
    balance: bigint;
    totalDeposited: bigint;
    totalWithdrawn: bigint;
}

export async function readDepositNativeInfo(instance: DepositNativeInstance): Promise<DepositNativeInfo> {
    const p = readProvider(instance.chainId);
    const contract = new Contract(instance.address, DEPOSIT_NATIVE_ABI, p);

    const [balance, deposited, withdrawn] = await Promise.all([
        p.getBalance(instance.address),
        contract.totalDeposited(),
        contract.totalWithdrawn(),
    ]);

    return {balance, totalDeposited: deposited, totalWithdrawn: withdrawn};
}

// managerWithdraw takes explicit to/amount — unlike Market/Stake/BHeroS there's no sweep-all
// variant, since draining the whole balance would take money still owed to depositors.
export async function withdrawDepositNative(instance: DepositNativeInstance, to: string, amount: bigint): Promise<string> {
    const signer = await walletSigner(instance.chainId);
    const contract = new Contract(instance.address, DEPOSIT_NATIVE_ABI, signer);
    const tx = await contract.managerWithdraw(to, amount);
    await tx.wait();
    return tx.hash;
}
