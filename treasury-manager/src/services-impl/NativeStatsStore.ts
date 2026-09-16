import {RedisClientType} from "redis";
import {NATIVE_NETWORKS, RedisKeys} from "../consts/Consts.js";
import ILogger from "../services/ILogger.js";
import {INativeStatsStore, NativeNetwork, NativeSnapshot, NativeSummary} from "../services/INativeStats.js";

// The exclusion list lives in Redis rather than the env because it is operator data: changing it must
// not need a container restart.
export default class NativeStatsStore implements INativeStatsStore {
    private log: ILogger;

    constructor(logger: ILogger, private redis: RedisClientType) {
        this.log = logger.clone("[NativeStore]");
    }

    async excludedUids(): Promise<number[]> {
        const raw = await this.redis.sMembers(RedisKeys.NATIVE_EXCLUDED_UIDS);
        const uids = raw.map((v) => Number(v)).filter((v) => Number.isInteger(v));
        if (uids.length !== raw.length) {
            this.log.warn(`excluded uid set holds ${raw.length - uids.length} non-integer member(s) — ignored`);
        }
        return uids.sort((a, b) => a - b);
    }

    async setExcludedUids(uids: number[]): Promise<void> {
        const key = RedisKeys.NATIVE_EXCLUDED_UIDS;
        await this.redis.del(key);
        if (uids.length > 0) await this.redis.sAdd(key, uids.map(String));
    }

    async cachedSummary(network: NativeNetwork): Promise<NativeSummary | null> {
        const raw = await this.redis.get(RedisKeys.NATIVE_SUMMARY_PREFIX + network);
        return raw ? (JSON.parse(raw) as NativeSummary) : null;
    }

    async cacheSummary(summary: NativeSummary, ttlSeconds: number): Promise<void> {
        await this.redis.set(RedisKeys.NATIVE_SUMMARY_PREFIX + summary.network, JSON.stringify(summary), {
            EX: ttlSeconds,
        });
    }

    async dropCachedSummaries(): Promise<void> {
        await Promise.all(NATIVE_NETWORKS.map((n) => this.redis.del(RedisKeys.NATIVE_SUMMARY_PREFIX + n)));
    }

    async snapshot(network: NativeNetwork, date: string): Promise<NativeSnapshot | null> {
        const raw = await this.redis.hGet(RedisKeys.NATIVE_DAILY_PREFIX + network, date);
        return raw ? (JSON.parse(raw) as NativeSnapshot) : null;
    }

    // A closed day never changes, so snapshots carry no TTL.
    async putSnapshot(network: NativeNetwork, snapshot: NativeSnapshot): Promise<void> {
        await this.redis.hSet(
            RedisKeys.NATIVE_DAILY_PREFIX + network,
            snapshot.date,
            JSON.stringify(snapshot),
        );
    }

    async snapshots(network: NativeNetwork): Promise<NativeSnapshot[]> {
        const all = await this.redis.hGetAll(RedisKeys.NATIVE_DAILY_PREFIX + network);
        return Object.values(all)
            .map((raw) => JSON.parse(raw) as NativeSnapshot)
            .sort((a, b) => a.date.localeCompare(b.date));
    }
}
