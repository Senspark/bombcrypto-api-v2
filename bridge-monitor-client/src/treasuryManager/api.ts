// REST client for the treasury-manager backend. Unlike the other treasury tabs this module never
// touches MetaMask — the backend holds the manager key and signs the swaps itself.
const BASE = "/treasury";

export interface TreasuryInstance {
    id: string;
    label: string;
    kind: "market" | "bheros";
    chainId: number;
    address: string;
}

export interface SwapRoute {
    id: string;
    chainId: number;
    label: string;
    kind: "v2" | "algebra" | "smart";
    tokenIn: string;
    tokenInSymbol: string;
    tokenOut: string;
    tokenOutSymbol: string;
}

export type ScheduleStatus = "active" | "stopped" | "completed" | "error";

export interface ScheduleConfig {
    id: string;
    instanceId: string;
    routeId: string;
    chainId: number;
    intervalMs: number;
    amountPerRun: string;
    capTotal: string;
    slippageBps: number;
    createdAt: number;
    createdBy: string;
}

export interface ScheduleState {
    status: ScheduleStatus;
    swappedSoFar: string;
    runCount: number;
    lastRunAt: number | null;
    nextRunAt: number;
    lastError: string | null;
}

export interface RunRecord {
    at: number;
    ok: boolean;
    txHash: string | null;
    amountIn: string | null;
    expectedOut: string | null;
    minOut: string | null;
    error: string | null;
}

export interface TreasuryReading {
    fees: string;
    usdt: string;
    usdtConfigured: boolean;
    routerAllowed: boolean;
}

export class UnauthorizedError extends Error {
    constructor() {
        super("unauthorized");
    }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {credentials: "include", ...init});
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error ?? `${path} -> HTTP ${res.status}`);
    }
    return (await res.json()) as T;
}

function postJson<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

export const api = {
    me: () => request<{email: string}>("/auth/me"),
    login: (credential: string) => postJson<{email: string}>("/auth/google", {credential}),
    logout: () => postJson<{ok: boolean}>("/auth/logout"),

    catalog: () => request<{instances: TreasuryInstance[]; routes: SwapRoute[]}>("/catalog"),
    schedules: () => request<{schedules: {config: ScheduleConfig; state: ScheduleState}[]}>("/schedules"),
    runs: (id: string) => request<{runs: RunRecord[]}>(`/schedules/${encodeURIComponent(id)}/runs`),
    reading: (instanceId: string, routeId: string) =>
        request<TreasuryReading>(`/reading/${encodeURIComponent(instanceId)}/${encodeURIComponent(routeId)}`),

    createSchedule: (body: {
        instanceId: string;
        routeId: string;
        intervalMs: number;
        amountPerRun: string;
        capTotal: string;
        slippageBps: number;
    }) => postJson<{config: ScheduleConfig; state: ScheduleState}>("/schedules", body),
    stopSchedule: (id: string) => postJson<{ok: boolean}>(`/schedules/${encodeURIComponent(id)}/stop`),
    deleteSchedule: (id: string) => request<{ok: boolean}>(`/schedules/${encodeURIComponent(id)}`, {method: "DELETE"}),
    runOnce: (body: {instanceId: string; routeId: string; amount: string; slippageBps: number}) =>
        postJson<{txHash: string; amountIn: string; expectedOut: string; minOut: string}>("/swap/run-once", body),
};
