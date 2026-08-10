import {RedisClientType} from "redis";
import {RedisKeys, RUN_HISTORY_LIMIT} from "../consts/Consts.js";
import ILogger from "../services/ILogger.js";
import {IScheduleStore, RunRecord, ScheduleConfig, ScheduleState} from "../services/ISchedule.js";

export default class ScheduleStore implements IScheduleStore {
    private log: ILogger;

    constructor(logger: ILogger, private redis: RedisClientType) {
        this.log = logger.clone("[Store]");
    }

    async list(): Promise<{config: ScheduleConfig; state: ScheduleState}[]> {
        const ids = await this.redis.sMembers(RedisKeys.SCHEDULE_IDS);
        const entries = await Promise.all(ids.map((id) => this.get(id)));
        return entries.filter((e): e is {config: ScheduleConfig; state: ScheduleState} => e !== null);
    }

    async get(id: string): Promise<{config: ScheduleConfig; state: ScheduleState} | null> {
        const [rawConfig, rawState] = await Promise.all([
            this.redis.get(RedisKeys.CONFIG_PREFIX + id),
            this.redis.get(RedisKeys.STATE_PREFIX + id),
        ]);
        if (!rawConfig || !rawState) {
            // An id in the set with no config is leftover from a partially failed delete.
            if (!rawConfig) {
                this.log.warn(`schedule ${id} listed but has no config — dropping from the index`);
                await this.redis.sRem(RedisKeys.SCHEDULE_IDS, id).catch(() => {});
            }
            return null;
        }
        return {config: JSON.parse(rawConfig), state: JSON.parse(rawState)};
    }

    async put(config: ScheduleConfig, state: ScheduleState): Promise<void> {
        await Promise.all([
            this.redis.set(RedisKeys.CONFIG_PREFIX + config.id, JSON.stringify(config)),
            this.redis.set(RedisKeys.STATE_PREFIX + config.id, JSON.stringify(state)),
            this.redis.sAdd(RedisKeys.SCHEDULE_IDS, config.id),
        ]);
    }

    async putState(id: string, state: ScheduleState): Promise<void> {
        await this.redis.set(RedisKeys.STATE_PREFIX + id, JSON.stringify(state));
    }

    async remove(id: string): Promise<void> {
        await Promise.all([
            this.redis.sRem(RedisKeys.SCHEDULE_IDS, id),
            this.redis.del(RedisKeys.CONFIG_PREFIX + id),
            this.redis.del(RedisKeys.STATE_PREFIX + id),
            this.redis.del(RedisKeys.RUNS_PREFIX + id),
        ]);
    }

    async pushRun(id: string, record: RunRecord): Promise<void> {
        const key = RedisKeys.RUNS_PREFIX + id;
        await this.redis.lPush(key, JSON.stringify(record));
        await this.redis.lTrim(key, 0, RUN_HISTORY_LIMIT - 1);
    }

    async runs(id: string): Promise<RunRecord[]> {
        const raw = await this.redis.lRange(RedisKeys.RUNS_PREFIX + id, 0, RUN_HISTORY_LIMIT - 1);
        return raw.map((r) => JSON.parse(r) as RunRecord);
    }

    // Serialises swaps per chain so two schedules can never build a transaction against the same
    // nonce. Also makes a second container instance harmless rather than a double-spend of treasury.
    async acquireChainLock(chainId: number, ttlMs: number): Promise<boolean> {
        const res = await this.redis.set(RedisKeys.LOCK_PREFIX + chainId, "1", {NX: true, PX: ttlMs});
        return res === "OK";
    }

    async releaseChainLock(chainId: number): Promise<void> {
        await this.redis.del(RedisKeys.LOCK_PREFIX + chainId).catch(() => {});
    }
}
