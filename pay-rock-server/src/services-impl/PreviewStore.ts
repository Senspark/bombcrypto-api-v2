import {RedisClientType} from "redis";
import ILogger from "../services/ILogger";
import IPreviewStore, {IPreviewBody} from "../services/IPreviewStore";
import {Network, RedisKeys} from "../consts/Consts";

const keyR = (network: Network, tx: string) => `${RedisKeys.PAY_ROCK_PREVIEW}:${network}:${tx.toLowerCase()}`;

export default class PreviewStore implements IPreviewStore {
    readonly #redis: RedisClientType;
    readonly #logger: ILogger;
    readonly #ttlSeconds: number;

    constructor(redis: RedisClientType, logger: ILogger, ttlSeconds: number) {
        this.#redis = redis;
        this.#logger = logger.clone('[PreviewStore]');
        this.#ttlSeconds = ttlSeconds;
    }

    async get(tx: string, network: Network): Promise<IPreviewBody | null> {
        const key = keyR(network, tx);
        const raw = await this.#redis.get(key);
        if (!raw) return null;
        try {
            return JSON.parse(raw) as IPreviewBody;
        } catch (e) {
            this.#logger.error(`get parse failed for ${key}: ${(e as Error).message}`);
            return null;
        }
    }

    async save(body: IPreviewBody): Promise<void> {
        const key = keyR(body.input.network, body.input.tx);
        await this.#redis.set(key, JSON.stringify(body), {EX: this.#ttlSeconds});
    }

    async consume(tx: string, network: Network): Promise<IPreviewBody | null> {
        const key = keyR(network, tx);
        const raw = await (this.#redis as any).getDel?.(key) ?? await this.#fallbackGetDel(key);
        if (!raw) return null;
        try {
            return JSON.parse(raw) as IPreviewBody;
        } catch (e) {
            this.#logger.error(`consume parse failed for ${key}: ${(e as Error).message}`);
            return null;
        }
    }

    async #fallbackGetDel(key: string): Promise<string | null> {
        const val = await this.#redis.get(key);
        if (val != null) await this.#redis.del(key);
        return val;
    }
}
