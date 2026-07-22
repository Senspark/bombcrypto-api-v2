import pg from "pg";
import ILogger from "../services/ILogger";
import IShareAnalyticsStore from "../services/IShareAnalyticsStore";
import {ShareRecord} from "../services/IShareStore";

export default class PostgresShareAnalyticsStore implements IShareAnalyticsStore {
    readonly #pg: pg.Pool;
    readonly #logger: ILogger;

    constructor(pgPool: pg.Pool, logger: ILogger) {
        this.#pg = pgPool;
        this.#logger = logger.clone('[SHARE-ANALYTICS]');
    }

    async record(id: string, record: ShareRecord): Promise<void> {
        await this.#pg.query(
            `INSERT INTO public.share_events
                 (id, wallet, source, title, description, text, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))
             ON CONFLICT (id) DO NOTHING`,
            [id, record.wallet, record.source, record.title, record.description, record.text, record.createdAt],
        );
    }
}
