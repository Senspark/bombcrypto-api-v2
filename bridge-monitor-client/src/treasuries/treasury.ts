// Service for the Treasury Manager tab: the holding treasuries (marketing, burn) and the community
// pool. The dev treasury has its own module — it is the only one that swaps.
//
// Community is a MasterRewardPool, not a TreasuryBase: different exit (adminWithdraw, note the
// receiver-before-token argument order), a child-pool transfer driven by a per-token limit, and a
// role set the operator wallet does not hold. Everything here reads for anyone and writes only for
// whoever holds the role, so a wallet without it sees the numbers and gets a revert on the button.
import {Contract, ZeroAddress} from "ethers";
import {readProvider, walletSigner} from "../treasury/wallet";
import {ERC20_ABI} from "../treasury/types";
import {SPLITTER_ABI} from "../treasury/splitter";
import {tokensFor, type ChainTreasuries, type TokenRef} from "./config";

const TREASURY_ABI = [
    "function withdrawTo(address token, address receiver, uint256 amount)",
    "function burnToken(address token, uint256 amount)",
];

const POOL_ABI = [
    "function childPool() view returns (address)",
    "function tokenLimits(address) view returns (uint256)",
    "function adminWithdraw(address receiver, address token, uint256 amount)",
    "function transferToChildPool(address token)",
    "function setTokenTransferLimit(address token, uint256 limit)",
    "function setChildPool(address value)",
];

export interface TokenBalance extends TokenRef {
    balance: bigint;
    decimals: number;
    limit?: bigint; // community pool only: how much transferToChildPool would move
}

export interface TreasuryAddresses {
    community: string;
    marketing: string;
    burn: string;
    dev: string;
}

export async function readTreasuryAddresses(instance: ChainTreasuries): Promise<TreasuryAddresses> {
    const splitter = new Contract(instance.splitter, SPLITTER_ABI, readProvider(instance.chainId));
    const [community, marketing, burn, dev] = await Promise.all([
        splitter.communityTreasury(),
        splitter.marketingTreasury(),
        splitter.burnTreasury(),
        splitter.devTreasury(),
    ]);
    return {community, marketing, burn, dev};
}

export async function readBalances(
    chainId: number,
    holder: string,
    withLimits = false,
): Promise<TokenBalance[]> {
    const p = readProvider(chainId);
    const pool = withLimits ? new Contract(holder, POOL_ABI, p) : null;
    return Promise.all(
        tokensFor(chainId).map(async (t) => {
            const token = new Contract(t.address, ERC20_ABI, p);
            const [balance, decimals, limit] = await Promise.all([
                token.balanceOf(holder),
                token.decimals(),
                pool ? pool.tokenLimits(t.address).catch(() => undefined) : Promise.resolve(undefined),
            ]);
            return {...t, balance, decimals: Number(decimals), limit};
        }),
    );
}

export async function readChildPool(chainId: number, pool: string): Promise<string> {
    if (pool === ZeroAddress) return ZeroAddress;
    return new Contract(pool, POOL_ABI, readProvider(chainId)).childPool();
}

async function send(chainId: number, address: string, abi: string[], fn: string, args: unknown[]): Promise<string> {
    const signer = await walletSigner(chainId);
    const tx = await new Contract(address, abi, signer)[fn](...args);
    await tx.wait();
    return tx.hash;
}

// --- marketing / burn: plain TreasuryBase holders ---

export function withdrawFromTreasury(
    chainId: number, treasury: string, token: string, receiver: string, amount: bigint,
): Promise<string> {
    return send(chainId, treasury, TREASURY_ABI, "withdrawTo", [token, receiver, amount]);
}

// Destroys the tokens: the contract calls the token's own burn(uint256), so total supply drops.
export function burnFromTreasury(
    chainId: number, treasury: string, token: string, amount: bigint,
): Promise<string> {
    return send(chainId, treasury, TREASURY_ABI, "burnToken", [token, amount]);
}

// --- community: MasterRewardPool ---

export function poolWithdraw(
    chainId: number, pool: string, token: string, receiver: string, amount: bigint,
): Promise<string> {
    return send(chainId, pool, POOL_ABI, "adminWithdraw", [receiver, token, amount]);
}

// Moves exactly tokenLimits[token] — the amount is the limit, not a parameter.
export function poolTransferToChild(chainId: number, pool: string, token: string): Promise<string> {
    return send(chainId, pool, POOL_ABI, "transferToChildPool", [token]);
}

export function poolSetLimit(chainId: number, pool: string, token: string, limit: bigint): Promise<string> {
    return send(chainId, pool, POOL_ABI, "setTokenTransferLimit", [token, limit]);
}

export function poolSetChild(chainId: number, pool: string, child: string): Promise<string> {
    return send(chainId, pool, POOL_ABI, "setChildPool", [child]);
}
