import pg from "pg";
import ILogger from "../services/ILogger";
import SliceCache from "../utils/SliceCache";
import {Network} from "../consts/Consts";

const ACTIVE_HEROES_TTL_MS = 5_000;
const PENDING_REWARDS_TTL_MS = 5_000;
const DAILY_EARNINGS_TTL_MS = 60 * 60 * 1000;

export interface ActiveHero {
    bomberId: number;
    rarity: number;
    stage: number;
    stakeBcoin: number;
    stakeSen: number;
    network: Network;
}

export type RewardType = 'BCOIN' | 'SENSPARK';

export interface PendingReward {
    rewardType: RewardType;
    value: number;
    network: Network;
}

export interface DailyEarning {
    date: string;    // ISO yyyy-mm-dd
    network: Network;
    bcoin: number;
    sen: number;
    coin: number;
}

export default class WatchRepository {
    readonly #pg: pg.Pool;
    readonly #logger: ILogger;
    readonly #heroes: SliceCache<number, ActiveHero[]>;
    readonly #pendingRewards: SliceCache<number, PendingReward[]>;
    readonly #dailyEarnings: SliceCache<number, DailyEarning[]>;

    constructor(pgPool: pg.Pool, logger: ILogger) {
        this.#pg = pgPool;
        this.#logger = logger.clone('[WatchRepo]');
        this.#heroes = new SliceCache(ACTIVE_HEROES_TTL_MS, (uid) => this.#fetchActiveHeroes(uid));
        this.#pendingRewards = new SliceCache(PENDING_REWARDS_TTL_MS, (uid) => this.#fetchPendingRewards(uid));
        this.#dailyEarnings = new SliceCache(DAILY_EARNINGS_TTL_MS, (uid) => this.#fetchDailyEarnings(uid));
    }

    getActiveHeroes(uid: number): Promise<ActiveHero[]> {
        return this.#heroes.get(uid);
    }

    getPendingRewards(uid: number): Promise<PendingReward[]> {
        return this.#pendingRewards.get(uid);
    }

    getDailyEarnings(uid: number): Promise<DailyEarning[]> {
        return this.#dailyEarnings.get(uid);
    }

    async #fetchActiveHeroes(uid: number): Promise<ActiveHero[]> {
        try {
            const result = await this.#pg.query<{
                bomber_id: string;
                rarity: number;
                stage: number;
                stake_bcoin: number;
                stake_sen: number;
                network: string;
            }>(
                `SELECT bomber_id, rare AS rarity, stage,
                        stake_amount AS stake_bcoin, stake_sen,
                        data_type AS network
                 FROM public.user_bomber
                 WHERE uid = $1
                   AND active = 1
                   AND "hasDelete" = 0
                   AND data_type IN ('BSC', 'POLYGON')
                 ORDER BY stake_amount DESC, rare DESC`,
                [uid],
            );
            return result.rows.map((row) => ({
                bomberId: Number(row.bomber_id),
                rarity: row.rarity,
                stage: row.stage,
                stakeBcoin: Number(row.stake_bcoin),
                stakeSen: Number(row.stake_sen),
                network: mapNetworkString(row.network),
            }));
        } catch (e) {
            this.#logger.error(e);
            throw e;
        }
    }

    async #fetchPendingRewards(uid: number): Promise<PendingReward[]> {
        try {
            const result = await this.#pg.query<{
                reward_type: string;
                value: number;
                network: string;
            }>(
                `SELECT reward_type, "values" AS value, type AS network
                 FROM public.user_block_reward
                 WHERE uid = $1
                   AND type IN ('BSC', 'POLYGON')
                   AND reward_type IN ('BCOIN', 'SENSPARK')
                   AND "values" > 0`,
                [uid],
            );
            return result.rows.map((row) => ({
                rewardType: row.reward_type as RewardType,
                value: Number(row.value),
                network: mapNetworkString(row.network),
            }));
        } catch (e) {
            this.#logger.error(e);
            throw e;
        }
    }

    async #fetchDailyEarnings(uid: number): Promise<DailyEarning[]> {
        try {
            const result = await this.#pg.query<{
                date: Date | string;
                network: number;
                bcoin: number;
                sen: number;
                coin: number;
            }>(
                `SELECT "timestamp"::date AS date,
                        network_id AS network,
                        COALESCE(SUM(reward_bcoin), 0) AS bcoin,
                        COALESCE(SUM(reward_sen),   0) AS sen,
                        COALESCE(SUM(reward_coin),  0) AS coin
                 FROM logs.th_mode_v2
                 WHERE uid = $1
                   AND "timestamp" >= CURRENT_DATE - INTERVAL '13 days'
                   AND network_id IN (0, 1)
                 GROUP BY "timestamp"::date, network_id
                 ORDER BY "timestamp"::date DESC, network_id ASC`,
                [uid],
            );

            return result.rows.map((row) => ({
                date: toIsoDate(row.date),
                network: mapNetworkInt(row.network),
                bcoin: Number(row.bcoin),
                sen: Number(row.sen),
                coin: Number(row.coin),
            }));
        } catch (e) {
            this.#logger.error(e);
            throw e;
        }
    }
}

function mapNetworkString(dataType: string): Network {
    switch (dataType) {
        case 'BSC': return Network.BSC;
        case 'POLYGON': return Network.POLYGON;
        default: throw new Error(`Unexpected network data_type: ${dataType}`);
    }
}

function mapNetworkInt(value: number): Network {
    switch (value) {
        case 0: return Network.BSC;
        case 1: return Network.POLYGON;
        default: throw new Error(`Unexpected network int: ${value}`);
    }
}

function toIsoDate(value: Date | string): string {
    if (value instanceof Date) {
        // Use UTC to avoid timezone slips; pg `date` is a calendar date, no tz.
        const y = value.getUTCFullYear();
        const m = String(value.getUTCMonth() + 1).padStart(2, '0');
        const d = String(value.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    return value.slice(0, 10);
}
