import "dotenv/config";
import {bool, cleanEnv, num, port, str} from "envalid";
import IEnvConfig from "../services/IEnvConfig.js";
import {BSC_CHAIN_ID, POLYGON_CHAIN_ID} from "../consts/Consts.js";

export default class EnvConfig implements IEnvConfig {
    isProduction: boolean;
    port: number;
    appVersion: string;
    authEnabled: boolean;
    googleClientId: string;
    allowedEmailDomain: string;
    sessionTtlSeconds: number;
    redisConnectionString: string;
    managerPrivateKey: string;
    rpcByChainId: Record<number, string>;
    tickIntervalMs: number;
    minNativeBalance: string;

    constructor() {
        const env = cleanEnv(process.env, {
            IS_PROD: bool({default: false}),
            PORT: port({default: 8110}),
            APP_VERSION: str({default: "dev"}),
            IS_GCLOUD: bool({default: false}),
            GOOGLE_CLIENT_ID: str({default: ""}),
            ALLOWED_EMAIL_DOMAIN: str({default: "senspark.com"}),
            SESSION_TTL_SECONDS: num({default: 43_200}),
            REDIS_CONNECTION_STRING: str({default: ""}),
            MANAGER_PRIVATE_KEY: str({default: ""}),
            BSC_RPC: str({default: "https://bsc-dataseed.binance.org"}),
            POLYGON_RPC: str({default: "https://polygon-bor-rpc.publicnode.com"}),
            TICK_INTERVAL_MS: num({default: 30_000}),
            MIN_NATIVE_BALANCE: str({default: "0.005"}),
        });

        this.isProduction = env.IS_PROD;
        this.port = env.PORT;
        this.appVersion = env.APP_VERSION;
        this.authEnabled = env.IS_GCLOUD;
        this.googleClientId = env.GOOGLE_CLIENT_ID;
        this.allowedEmailDomain = env.ALLOWED_EMAIL_DOMAIN;
        this.sessionTtlSeconds = env.SESSION_TTL_SECONDS;
        this.redisConnectionString = env.REDIS_CONNECTION_STRING;
        this.managerPrivateKey = env.MANAGER_PRIVATE_KEY;
        this.rpcByChainId = {
            [BSC_CHAIN_ID]: env.BSC_RPC,
            [POLYGON_CHAIN_ID]: env.POLYGON_RPC,
        };
        this.tickIntervalMs = env.TICK_INTERVAL_MS;
        this.minNativeBalance = env.MIN_NATIVE_BALANCE;

        if (this.authEnabled && !this.googleClientId) {
            throw new Error("GOOGLE_CLIENT_ID is required when IS_GCLOUD is true");
        }
    }
}
