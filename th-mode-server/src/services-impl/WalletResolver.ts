import pg from "pg";
import ILogger from "../services/ILogger";
import SliceCache from "../utils/SliceCache";
import {removeNameSuffix} from "../utils/UserNameSuffix";

const HIT_TTL_MS = 60 * 60 * 1000;    // 1h — username is stable
const MISS_TTL_MS = 5 * 60 * 1000;    // 5min — give freshly-registered wallets a chance

export interface IResolvedWallet {
    uid: number;
    userName: string;
}

export default class WalletResolver {
    readonly #pg: pg.Pool;
    readonly #logger: ILogger;
    readonly #cache: SliceCache<string, IResolvedWallet | null>;

    constructor(pgPool: pg.Pool, logger: ILogger) {
        this.#pg = pgPool;
        this.#logger = logger.clone('[WalletResolver]');
        this.#cache = new SliceCache(
            (v) => v === null ? MISS_TTL_MS : HIT_TTL_MS,
            (wallet) => this.#fetch(wallet),
        );
    }

    async resolve(wallet: string): Promise<IResolvedWallet | null> {
        // The game server now sends `#`-separated identities (`<wallet>#bsc`/`#tr`); `public.user`
        // stores the bare wallet, so strip the suffix before the exact match or it returns 404.
        const normalized = removeNameSuffix(wallet).toLowerCase();
        return this.#cache.get(normalized);
    }

    async #fetch(wallet: string): Promise<IResolvedWallet | null> {
        try {
            const result = await this.#pg.query<{ id_user: number; user_name: string }>(
                'SELECT id_user, user_name FROM public."user" WHERE user_name = $1 LIMIT 1',
                [wallet],
            );
            if (result.rowCount === 0) {
                return null;
            }
            const row = result.rows[0];
            return {uid: row.id_user, userName: row.user_name};
        } catch (e) {
            this.#logger.error(e);
            throw e;
        }
    }
}
