import {RedisClientType} from "redis";
import ILogger from "../services/ILogger";
import IRateLimiter from "../services/IRateLimiter";
import getRedisClient from "./Redis";
import {RedisKeys} from "../consts/RedisKeys";

const KEY_TTL_SECONDS = 90000; // ~25h, covers a calendar day plus TZ slack

export default class RedisRateLimiter implements IRateLimiter {
    readonly #redis: RedisClientType;
    readonly #logger: ILogger;
    readonly #perDay: number;

    constructor(logger: ILogger, redisConnectionString: string, perDay: number) {
        this.#logger = logger.clone('[RATE]');
        this.#redis = getRedisClient(redisConnectionString);
        this.#perDay = perDay;
    }

    async hit(wallet: string): Promise<boolean> {
        try {
            const key = `${RedisKeys.RATE_LIMIT}:${wallet}:${this.today()}`;
            const count = await this.#redis.incr(key);
            if (count === 1) {
                await this.#redis.expire(key, KEY_TTL_SECONDS);
            }
            return count <= this.#perDay;
        } catch (e) {
            // A Redis hiccup must not block a legitimate share.
            this.#logger.error(`hit failed, allowing: ${e}`);
            return true;
        }
    }

    private today(): string {
        const d = new Date();
        const y = d.getFullYear();
        const m = `${d.getMonth() + 1}`.padStart(2, '0');
        const day = `${d.getDate()}`.padStart(2, '0');
        return `${y}${m}${day}`;
    }
}
