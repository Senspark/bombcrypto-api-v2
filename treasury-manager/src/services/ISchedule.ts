export type ScheduleStatus = "active" | "stopped" | "completed" | "error";

export interface ScheduleConfig {
    id: string;
    instanceId: string;
    routeId: string;
    chainId: number;
    intervalMs: number;
    /** Human units, e.g. "10.5". Converted with the token's on-chain decimals at run time. */
    amountPerRun: string;
    /** Human units. Cumulative ceiling across every run of this schedule. */
    capTotal: string;
    slippageBps: number;
    createdAt: number;
    createdBy: string;
}

export interface ScheduleState {
    status: ScheduleStatus;
    /** Human units, cumulative across successful runs. */
    swappedSoFar: string;
    runCount: number;
    lastRunAt: number | null;
    nextRunAt: number;
    /** Client-safe text. The raw error only ever reaches the log. */
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

export interface IScheduleStore {
    list(): Promise<{config: ScheduleConfig; state: ScheduleState}[]>;
    get(id: string): Promise<{config: ScheduleConfig; state: ScheduleState} | null>;
    put(config: ScheduleConfig, state: ScheduleState): Promise<void>;
    putState(id: string, state: ScheduleState): Promise<void>;
    remove(id: string): Promise<void>;
    pushRun(id: string, record: RunRecord): Promise<void>;
    runs(id: string): Promise<RunRecord[]>;
    acquireChainLock(chainId: number, ttlMs: number): Promise<boolean>;
    releaseChainLock(chainId: number): Promise<void>;
}
