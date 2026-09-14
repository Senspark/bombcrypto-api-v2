// REST client for the treasury-manager's DepositNative reporting. The figures come from the game
// database (what users have already spent in game), which no on-chain read can provide.
import {UnauthorizedError} from "../treasuryManager/api";

const BASE = "/treasury/native";

export type NativeNetwork = "BSC" | "POLYGON";

/** Every amount is an exact wei integer as a decimal string. */
export interface NativeTotals {
    userCount: number;
    depositedWei: string;
    withdrawnWei: string;
    pendingWei: string;
    spendableWei: string;
    spentInGameWei: string;
}

export interface NativeSummary {
    network: NativeNetwork;
    included: NativeTotals;
    excluded: NativeTotals;
    excludedUids: number[];
    at: number;
}

export interface NativeDailyPoint {
    date: string;
    depositedWei: string;
    spentWei: string;
    spanDays: number;
    basisChanged: boolean;
    partial: boolean;
}

export {UnauthorizedError};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {credentials: "include", ...init});
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error ?? `${path} -> HTTP ${res.status}`);
    }
    return (await res.json()) as T;
}

export const nativeApi = {
    summary: (network: NativeNetwork) => request<NativeSummary>(`/summary?network=${network}`),
    daily: (network: NativeNetwork, days = 30) =>
        request<{points: NativeDailyPoint[]}>(`/daily?network=${network}&days=${days}`),
    excludedUids: () => request<{uids: number[]}>("/excluded-uids"),
    setExcludedUids: (uids: number[]) =>
        request<{uids: number[]}>("/excluded-uids", {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({uids}),
        }),
};

/**
 * Solvency is about every depositor, so it sums both buckets. The exclusion list exists to keep test
 * accounts out of the reported statistics — those accounts still put real money into the contract,
 * and leaving them out here would overstate what is safe to withdraw.
 */
export function spentInGameAll(summary: NativeSummary): bigint {
    return BigInt(summary.included.spentInGameWei) + BigInt(summary.excluded.spentInGameWei);
}
