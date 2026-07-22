import {RedisClientType} from "redis";
import ILogger from "../services/ILogger";
import IShareStore, {ShareRecord} from "../services/IShareStore";
import getRedisClient from "./Redis";
import {RedisKeys} from "../consts/RedisKeys";

const key = (id: string) => `${RedisKeys.SHARE}:${id}`;

export default class RedisShareStore implements IShareStore {
    readonly #redis: RedisClientType;
    readonly #logger: ILogger;
    readonly #ttlSeconds: number;

    constructor(logger: ILogger, redisConnectionString: string, ttlSeconds: number) {
        this.#logger = logger.clone('[SHARE-STORE]');
        this.#redis = getRedisClient(redisConnectionString);
        this.#ttlSeconds = ttlSeconds;
    }

    async save(id: string, record: ShareRecord): Promise<void> {
        await this.#redis.set(key(id), JSON.stringify(record), {EX: this.#ttlSeconds});
    }

    async get(id: string): Promise<ShareRecord | null> {
        const raw = await this.#redis.get(key(id));
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw) as ShareRecord;
        } catch (e) {
            this.#logger.error(`Corrupt record for ${id}: ${e}`);
            return null;
        }
    }

    async delete(id: string): Promise<void> {
        await this.#redis.del(key(id));
    }
}
