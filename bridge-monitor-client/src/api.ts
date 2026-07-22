import type {
    AggregateResponse, AnomalyRecheckResult, AnomalyRow, BackfillRequest, BackfillResult, Chain, GapRow,
    GapSweepResult, HealthResponse, LedgerKind, LedgerRow, LifecycleRow, LifecycleStatus, TokenSym,
    TransactionsResponse, WalletRow,
} from "./types";

const BASE = "/monitor";

async function getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) throw new Error(`GET ${path} -> HTTP ${res.status}`);
    return (await res.json()) as T;
}

async function postJson<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {method: "POST"});
    if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`POST ${path} -> HTTP ${res.status} ${detail}`);
    }
    return (await res.json()) as T;
}

function qs(params: Record<string, string | number | undefined>): string {
    const parts = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
    return parts.length ? `?${parts.join("&")}` : "";
}

export const api = {
    version: () => getJson<{version: string; code: string}>("/version"),
    aggregate: (force = false) => getJson<AggregateResponse>(`/aggregate${force ? "?refresh=1" : ""}`),
    health: (force = false) => getJson<HealthResponse>(`/health${force ? "?refresh=1" : ""}`),
    gaps: () => getJson<GapRow[]>("/gaps"),
    sweepGap: (id: number) => postJson<GapSweepResult>(`/gaps/${id}/sweep`),
    discardGap: (id: number) => postJson<{gapId: number; chain: Chain}>(`/gaps/${id}/discard`),
    anomalies: (limit = 200) => getJson<AnomalyRow[]>(`/anomalies${qs({limit})}`),
    recheckAnomaly: (id: number) => postJson<AnomalyRecheckResult>(`/anomalies/${id}/recheck`),
    lifecycle: (status?: LifecycleStatus, limit = 200) => getJson<LifecycleRow[]>(`/lifecycle${qs({status, limit})}`),
    wallets: (chain?: Chain, token?: TokenSym, limit = 1000) => getJson<WalletRow[]>(`/wallets${qs({chain, token, limit})}`),
    wallet: (wallet: string) => getJson<WalletRow[]>(`/wallet/${encodeURIComponent(wallet)}`),
    walletLedger: (wallet: string) => getJson<LedgerRow[]>(`/wallet/${encodeURIComponent(wallet)}/ledger`),
    transactions: (filter: {chain?: Chain; token?: TokenSym; kind?: LedgerKind}, page = 1, pageSize = 50) =>
        getJson<TransactionsResponse>(`/transactions${qs({...filter, page, pageSize})}`),

    async backfill(body: BackfillRequest): Promise<BackfillResult> {
        const res = await fetch(`${BASE}/backfill`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => "");
            throw new Error(`POST /backfill -> HTTP ${res.status} ${detail}`);
        }
        return (await res.json()) as BackfillResult;
    },
};
