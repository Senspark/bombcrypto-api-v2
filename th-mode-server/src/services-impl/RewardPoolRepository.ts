import pg from "pg";
import ILogger from "../services/ILogger";
import SliceCache from "../utils/SliceCache";

const REWARD_POOLS_TTL_MS = 60_000;
const CACHE_KEY = 0;

export interface IRewardPoolInfo {
    poolId: number;
    bcoinRemaining: number;
    bcoinMax: number;
    senRemaining: number;
    senMax: number;
}

export default class RewardPoolRepository {
    readonly #pg: pg.Pool;
    readonly #logger: ILogger;
    readonly #pools: SliceCache<number, IRewardPoolInfo[]>;

    constructor(pgPool: pg.Pool, logger: ILogger) {
        this.#pg = pgPool;
        this.#logger = logger.clone('[RewardPoolRepo]');
        this.#pools = new SliceCache(REWARD_POOLS_TTL_MS, () => this.#fetchRewardPools());
    }

    getRewardPools(): Promise<IRewardPoolInfo[]> {
        return this.#pools.get(CACHE_KEY);
    }

    async #fetchRewardPools(): Promise<IRewardPoolInfo[]> {
        try {
            const result = await this.#pg.query<{
                pool_id: number;
                type: string;
                remaining_reward: number;
                max_reward: number;
            }>(
                `SELECT pool_id, type, remaining_reward, max_reward
                 FROM public.config_reward_pool_th_v2
                 WHERE type IN ('BCOIN', 'SENSPARK')`,
            );

            const byPool = new Map<number, IRewardPoolInfo>();
            for (const row of result.rows) {
                const poolId = Number(row.pool_id);
                let entry = byPool.get(poolId);
                if (!entry) {
                    entry = {poolId, bcoinRemaining: 0, bcoinMax: 0, senRemaining: 0, senMax: 0};
                    byPool.set(poolId, entry);
                }
                if (row.type === 'BCOIN') {
                    entry.bcoinRemaining = Number(row.remaining_reward);
                    entry.bcoinMax = Number(row.max_reward);
                } else if (row.type === 'SENSPARK') {
                    entry.senRemaining = Number(row.remaining_reward);
                    entry.senMax = Number(row.max_reward);
                }
            }

            return [...byPool.values()].sort((a, b) => a.poolId - b.poolId);
        } catch (e) {
            this.#logger.error(e);
            throw e;
        }
    }
}
