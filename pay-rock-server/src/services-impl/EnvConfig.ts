import 'dotenv/config'
import {bool, cleanEnv, num, port, str} from 'envalid';
import IEnvConfig from "../services/IEnvConfig";

export default class EnvConfig implements IEnvConfig {
    isProduction: boolean;
    port: number;

    databaseUrl: string;
    blockchainApi: string;

    redisUrl: string;
    previewTtlSeconds: number;

    constructor() {
        const env = cleanEnv(process.env, {
            IS_PROD: bool({default: false}),
            PORT: port({default: 8107}),

            DATABASE_URL: str(),
            BLOCKCHAIN_API: str(),

            REDIS_URL: str(),
            PREVIEW_TTL_SECONDS: num({default: 300}),
        });

        this.isProduction = env.IS_PROD;
        this.port = env.PORT;

        this.databaseUrl = env.DATABASE_URL;
        this.blockchainApi = env.BLOCKCHAIN_API.replace(/\/+$/, '');

        this.redisUrl = env.REDIS_URL;
        this.previewTtlSeconds = env.PREVIEW_TTL_SECONDS;
    }
}
