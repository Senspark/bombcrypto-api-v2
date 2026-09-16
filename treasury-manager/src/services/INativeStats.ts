export type NativeNetwork = "BSC" | "POLYGON";

/** Every amount is an exact wei integer as a decimal string — never a JS number. */
export interface NativeTotals {
    userCount: number;
    depositedWei: string;
    withdrawnWei: string;
    pendingWei: string;
    /** Balance the users can still spend or withdraw. */
    spendableWei: string;
    /** deposited - withdrawn - pending - spendable. Turned into revenue, no longer owed. */
    spentInGameWei: string;
}

/**
 * `excluded` carries the same totals restricted to the uids in the exclusion set, so a reader can
 * see what the list is hiding instead of only its effect.
 */
export interface NativeReading {
    included: NativeTotals;
    excluded: NativeTotals;
    excludedUids: number[];
}

export interface NativeSummary extends NativeReading {
    network: NativeNetwork;
    at: number;
}

/** Closing figures for one day, keyed by that day's date in the snapshot timezone. */
export interface NativeSnapshot extends NativeReading {
    date: string;
    at: number;
    /**
     * The very first closing, taken when the service started rather than at the day boundary, so it
     * already contains part of the following day.
     */
    baseline?: boolean;
}

/** One day's movement, the difference between two consecutive closings. */
export interface NativeDailyPoint {
    date: string;
    depositedWei: string;
    spentWei: string;
    /** Days covered by this figure. Above 1 the service missed a closing and the movement is lumped. */
    spanDays: number;
    /** The exclusion list changed between the two closings, so the two sides are not comparable. */
    basisChanged: boolean;
    /** Measured from the start-up baseline, so it covers part of the day only and reads low. */
    partial: boolean;
}

export interface INativeStatsRepository {
    read(network: NativeNetwork, excludedUids: number[]): Promise<NativeReading>;
}

export interface INativeStatsStore {
    excludedUids(): Promise<number[]>;
    setExcludedUids(uids: number[]): Promise<void>;

    cachedSummary(network: NativeNetwork): Promise<NativeSummary | null>;
    cacheSummary(summary: NativeSummary, ttlSeconds: number): Promise<void>;
    dropCachedSummaries(): Promise<void>;

    snapshot(network: NativeNetwork, date: string): Promise<NativeSnapshot | null>;
    putSnapshot(network: NativeNetwork, snapshot: NativeSnapshot): Promise<void>;
    snapshots(network: NativeNetwork): Promise<NativeSnapshot[]>;
}
