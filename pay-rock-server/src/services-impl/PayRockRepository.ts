import pg from "pg";
import ILogger from "../services/ILogger";
import IPayRockRepository, {IExistingRockTx} from "../services/IPayRockRepository";
import {Network} from "../consts/Consts";

const HERO_CONFIG_TTL_MS = 5 * 60 * 1000;

export default class PayRockRepository implements IPayRockRepository {
    readonly #pg: pg.Pool;
    readonly #logger: ILogger;

    #heroConfigCache: { data: Map<number, [number, number]>; expiresAt: number } | null = null;

    constructor(pgPool: pg.Pool, logger: ILogger) {
        this.#pg = pgPool;
        this.#logger = logger.clone('[PayRockRepo]');
    }

    async findExistingRockTx(tx: string, network: Network): Promise<IExistingRockTx | null> {
        const result = await this.#pg.query<{ status: string; rock_amount: number; heroes: any }>(
            `SELECT status, rock_amount, heroes
             FROM public.user_create_rock
             WHERE tx = $1 AND network = $2
             ORDER BY "timestamp" DESC
             LIMIT 1`,
            [tx, network],
        );
        if (result.rowCount === 0) return null;
        const row = result.rows[0];
        const heroes = row.heroes;
        const heroIds = Array.isArray(heroes)
            ? heroes.map((h) => Number(h)).filter(Number.isFinite)
            : [];
        return {
            status: row.status,
            rockAmount: Number(row.rock_amount),
            heroIds,
        };
    }

    async findHeroGenIds(heroIds: number[], network: Network): Promise<string[]> {
        if (!heroIds.length) return [];
        const result = await this.#pg.query<{ gen_id: string }>(
            `SELECT gen_id
             FROM public.user_bomber
             WHERE bomber_id = ANY($1)
               AND type = 0
               AND data_type = $2`,
            [heroIds, network],
        );
        return result.rows.map(r => r.gen_id);
    }

    async getBurnHeroConfig(): Promise<Map<number, [number, number]>> {
        const now = Date.now();
        if (this.#heroConfigCache && now < this.#heroConfigCache.expiresAt) {
            return this.#heroConfigCache.data;
        }
        const result = await this.#pg.query<{ rarity: number; hero_s_rock: number; hero_l_rock: number }>(
            `SELECT rarity, hero_s_rock, hero_l_rock FROM public.config_burn_hero`,
        );
        const map = new Map<number, [number, number]>();
        for (const r of result.rows) {
            map.set(r.rarity, [Number(r.hero_s_rock), Number(r.hero_l_rock)]);
        }
        this.#heroConfigCache = {data: map, expiresAt: now + HERO_CONFIG_TTL_MS};
        return map;
    }

    async creditRock(wallet: string, tx: string, heroIds: number[], rockAmount: number, network: Network): Promise<void> {
        await this.#pg.query(
            `CALL public.sp_modify_rock_from_user_wallet($1, $2, $3, $4, $5)`,
            [wallet, tx, JSON.stringify(heroIds), rockAmount, network],
        );
    }

    async getUserRockBalance(wallet: string): Promise<number> {
        const result = await this.#pg.query<{ rock: string | number }>(
            `SELECT COALESCE(
                (SELECT values
                 FROM public.user_block_reward
                 WHERE uid = (SELECT id_user FROM public.user WHERE user_name = $1)
                   AND reward_type = 'ROCK'),
                0) AS rock`,
            [wallet.toLowerCase()],
        );
        return result.rowCount ? Number(result.rows[0].rock) : 0;
    }
}
