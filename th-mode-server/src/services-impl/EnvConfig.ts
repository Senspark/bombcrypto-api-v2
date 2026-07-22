import 'dotenv/config'
import {bool, cleanEnv, num, port, str} from 'envalid';
import {IEnvConfig} from "../Services";

export default class EnvConfig implements IEnvConfig {
    isProduction: boolean;
    port: number;
    refreshIntervalMs: number;
    redisConnectionString: string;
    databaseUrl: string;
    useMockData: boolean;
    clientThModePath: string;

    constructor() {
        const env = cleanEnv(process.env, {
            IS_PROD: bool({default: false}),
            PORT: port({default: 8106}),
            REFRESH_INTERVAL: num({default: 5000}),
            REDIS_CONNECTION_STRING: str({default: ''}),
            DATABASE_URL: str({default: ''}),
            USE_MOCK_DATA: bool({default: false}),
            CLIENT_TH_MODE_PATH: str({default: ''}),
        });

        this.isProduction = env.IS_PROD;
        this.port = env.PORT;
        this.refreshIntervalMs = env.REFRESH_INTERVAL;
        this.redisConnectionString = env.REDIS_CONNECTION_STRING;
        this.databaseUrl = env.DATABASE_URL;
        this.useMockData = env.USE_MOCK_DATA;
        this.clientThModePath = env.CLIENT_TH_MODE_PATH;
    }
}
