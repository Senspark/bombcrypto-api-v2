import { Pool } from "pg";
import IDatabaseService from "../services/IDatabaseService";
import ILogger from "../services/ILogger";

export default class PostgresDatabaseService implements IDatabaseService {
    private pool: Pool;
    private logger: ILogger;

    constructor(connectionString: string, logger: ILogger) {
        this.pool = new Pool({
            connectionString: connectionString,
        });
        this.logger = logger.clone("[DB]");
    }

    async query(sql: string, params?: any[]): Promise<any> {
        try {
            const res = await this.pool.query(sql, params);
            return res.rows;
        } catch (e) {
            this.logger.error(`Query failed: ${sql}`, e);
            throw e;
        }
    }
}
