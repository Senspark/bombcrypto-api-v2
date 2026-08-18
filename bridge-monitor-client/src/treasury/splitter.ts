// Shared TreasurySplitter reads and split maths, used by every source-contract module (market,
// BHeroS, BHeroStake). Deliberately one copy: the leg amounts here must match what
// TreasurySplitter.distribute computes on-chain, and three drifting copies of that rounding is the
// exact failure the on-chain design avoided by keeping ratios in one contract.
//
// All four legs are plain transfers of the fee token. The dev share goes to TreasuryDev, where it is
// swapped to USDT separately from the "Treasury Dev" tab — nothing on this path touches a router.
import {Contract, ZeroAddress} from "ethers";
import {readProvider} from "./wallet";
import {ERC20_ABI} from "./types";

export const SPLITTER_ABI = [
    "function communityTreasury() view returns (address)",
    "function marketingTreasury() view returns (address)",
    "function burnTreasury() view returns (address)",
    "function devTreasury() view returns (address)",
    "function splitOf(address) view returns (uint16 communityBps, uint16 devBps, uint16 marketingBps, uint16 burnBps, bool set)",
];

export interface SourceSplit {
    communityBps: number;
    devBps: number;
    marketingBps: number;
    burnBps: number;
    set: boolean;
}

export interface Legs {
    community: bigint;
    marketing: bigint;
    burn: bigint;
    dev: bigint;
}

export interface Treasuries {
    community: string;
    marketing: string;
    burn: string;
    dev: string; // ZeroAddress until setDevTreasury has been run on this chain
}

export interface SplitterView {
    split: SourceSplit | null; // null when the splitter has no ratios for this source
    treasuries: Treasuries | null;
    // Each treasury's balance of the fee token asked about, not its whole holdings.
    balances: {community: bigint; marketing: bigint; burn: bigint; dev: bigint} | null;
}

// Mirrors TreasurySplitter.distribute: the three shares are floored and the dev leg takes the
// remainder, so the four always add back to `amount` exactly.
export function computeLegs(amount: bigint, split: SourceSplit): Legs {
    const community = (amount * BigInt(split.communityBps)) / 10000n;
    const marketing = (amount * BigInt(split.marketingBps)) / 10000n;
    const burn = (amount * BigInt(split.burnBps)) / 10000n;
    return {community, marketing, burn, dev: amount - community - marketing - burn};
}

export async function readSplitterView(
    chainId: number,
    splitterAddress: string,
    sourceAddress: string,
    feeTokenAddress: string,
): Promise<SplitterView> {
    const p = readProvider(chainId);
    const splitter = new Contract(splitterAddress, SPLITTER_ABI, p);
    const feeToken = new Contract(feeTokenAddress, ERC20_ABI, p);

    const [community, marketing, burn, dev, rawSplit] = await Promise.all([
        splitter.communityTreasury(),
        splitter.marketingTreasury(),
        splitter.burnTreasury(),
        splitter.devTreasury(),
        splitter.splitOf(sourceAddress),
    ]);

    const [cBal, mBal, bBal, dBal] = await Promise.all([
        feeToken.balanceOf(community),
        feeToken.balanceOf(marketing),
        feeToken.balanceOf(burn),
        dev === ZeroAddress ? Promise.resolve(0n) : feeToken.balanceOf(dev),
    ]);

    return {
        split: rawSplit.set
            ? {
                  communityBps: Number(rawSplit.communityBps),
                  devBps: Number(rawSplit.devBps),
                  marketingBps: Number(rawSplit.marketingBps),
                  burnBps: Number(rawSplit.burnBps),
                  set: true,
              }
            : null,
        treasuries: {community, marketing, burn, dev},
        balances: {community: cBal, marketing: mBal, burn: bBal, dev: dBal},
    };
}

// The readiness conditions, each with its own message — "chưa cấu hình" on its own is the kind of
// thing that wastes an afternoon.
export function splitterBlockers(
    splitter: string | null,
    view: Pick<SplitterView, "split" | "treasuries"> | null,
): string[] {
    if (!splitter) return ["Contract chưa trỏ tới splitter — chạy setTreasurySplitter trên contract."];
    if (!view) return [];
    const out: string[] = [];
    if (!view.split) out.push("Splitter chưa có tỉ lệ cho contract này — chạy setSplit trên splitter.");
    if (view.split && view.split.devBps > 0 && view.treasuries?.dev === ZeroAddress) {
        out.push("Splitter chưa set devTreasury — chạy deploy-treasury-dev.js.");
    }
    return out;
}
