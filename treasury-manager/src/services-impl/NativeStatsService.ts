import ILogger from "../services/ILogger.js";
import {
    INativeStatsRepository,
    INativeStatsStore,
    NativeDailyPoint,
    NativeNetwork,
    NativeSnapshot,
    NativeSummary,
} from "../services/INativeStats.js";
import {dayKey, daysBetween, previousDay} from "./DayKey.js";

export default class NativeStatsService {
    private log: ILogger;

    constructor(
        logger: ILogger,
        private repository: INativeStatsRepository,
        private store: INativeStatsStore,
        private cacheTtlSeconds: number,
        private timeZone: string,
    ) {
        this.log = logger.clone("[NativeStats]");
    }

    async summary(network: NativeNetwork): Promise<NativeSummary> {
        const cached = await this.store.cachedSummary(network);
        if (cached) return cached;

        const summary = await this.read(network);
        await this.store.cacheSummary(summary, this.cacheTtlSeconds);
        return summary;
    }

    async setExcludedUids(uids: number[]): Promise<number[]> {
        const unique = [...new Set(uids)].sort((a, b) => a - b);
        await this.store.setExcludedUids(unique);
        // The cached summaries were computed against the old list; leaving them would report the old
        // figures until they expire, which reads as the change having been ignored.
        await this.store.dropCachedSummaries();
        return unique;
    }

    excludedUids(): Promise<number[]> {
        return this.store.excludedUids();
    }

    /**
     * Daily movement, derived from the closing figures rather than from any per-event log. The
     * cumulative totals only grow, so consecutive closings subtract cleanly.
     */
    async daily(network: NativeNetwork, days: number): Promise<NativeDailyPoint[]> {
        const snapshots = await this.store.snapshots(network);
        const points: NativeDailyPoint[] = [];
        for (let i = 1; i < snapshots.length; i++) {
            points.push(pointBetween(snapshots[i - 1], snapshots[i]));
        }
        return points.slice(-days);
    }

    /**
     * Records the closing figures for the day that has just ended, once. Called on every tick: the
     * first tick after midnight writes the row and the rest find it already there.
     */
    async captureClosing(network: NativeNetwork, now: Date): Promise<NativeSnapshot | null> {
        const date = previousDay(dayKey(now, this.timeZone));
        if (await this.store.snapshot(network, date)) return null;

        // Nothing stored yet means this is the start-up baseline: it is being taken in the middle of
        // the following day, so the first movement derived from it covers less than a full day.
        const baseline = (await this.store.snapshots(network)).length === 0;

        const reading = await this.repository.read(network, await this.store.excludedUids());
        const snapshot: NativeSnapshot = {...reading, date, at: now.getTime(), baseline};
        await this.store.putSnapshot(network, snapshot);
        this.log.info(
            `closed ${network} ${date}: deposited=${snapshot.included.depositedWei} spent=${snapshot.included.spentInGameWei}`,
        );
        return snapshot;
    }

    private async read(network: NativeNetwork): Promise<NativeSummary> {
        const excludedUids = await this.store.excludedUids();
        const reading = await this.repository.read(network, excludedUids);
        return {...reading, network, at: Date.now()};
    }
}

function pointBetween(from: NativeSnapshot, to: NativeSnapshot): NativeDailyPoint {
    return {
        date: to.date,
        depositedWei: (BigInt(to.included.depositedWei) - BigInt(from.included.depositedWei)).toString(),
        spentWei: (BigInt(to.included.spentInGameWei) - BigInt(from.included.spentInGameWei)).toString(),
        spanDays: daysBetween(from.date, to.date),
        basisChanged: !sameUids(from.excludedUids, to.excludedUids),
        partial: from.baseline === true,
    };
}

function sameUids(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((uid, i) => uid === b[i]);
}
