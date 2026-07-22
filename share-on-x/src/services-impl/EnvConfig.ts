import 'dotenv/config';
import {bool, cleanEnv, num, port, str} from 'envalid';
import IEnvConfig from "../services/IEnvConfig";

export default class EnvConfig implements IEnvConfig {
    port: number;
    isProduction: boolean;
    redisConnectionString: string;
    databaseUrl: string;
    shareBaseUrl: string;
    imageUrlBase: string;
    imageDir: string;
    shareTtlSeconds: number;
    imageMaxBytes: number;
    corsOrigins: string[];
    apLoginBaseUrl: string;
    slackWebhookUrl: string;
    adminToken: string;
    rateLimitPerDay: number;

    constructor() {
        const env = cleanEnv(process.env, {
            IS_PROD: bool({default: false}),
            PORT: port({default: 8108}),
            REDIS_CONNECTION_STRING: str({default: ''}),
            DATABASE_URL: str({default: ''}),
            SHARE_BASE_URL: str({default: 'https://bombcrypto.io'}),
            IMAGE_URL_BASE: str({default: 'https://bombcrypto.io/share-img'}),
            IMAGE_DIR: str({default: './share-assets'}),
            SHARE_TTL: num({default: 2592000}),
            IMAGE_MAX_BYTES: num({default: 2097152}),
            CORS_ORIGINS: str({default: ''}),
            AP_LOGIN_BASE_URL: str({default: 'http://ap-login:80'}),
            SLACK_WEBHOOK_URL: str({default: ''}),
            ADMIN_TOKEN: str({default: ''}),
            RATE_LIMIT_PER_DAY: num({default: 50}),
        });

        this.isProduction = env.IS_PROD;
        this.port = env.PORT;
        this.redisConnectionString = env.REDIS_CONNECTION_STRING;
        this.databaseUrl = env.DATABASE_URL;
        this.shareBaseUrl = env.SHARE_BASE_URL.replace(/\/+$/, '');
        this.imageUrlBase = env.IMAGE_URL_BASE.replace(/\/+$/, '');
        this.imageDir = env.IMAGE_DIR;
        this.shareTtlSeconds = env.SHARE_TTL;
        this.imageMaxBytes = env.IMAGE_MAX_BYTES;
        this.corsOrigins = env.CORS_ORIGINS
            .split(',')
            .map(o => o.trim())
            .filter(o => o.length > 0);
        this.apLoginBaseUrl = env.AP_LOGIN_BASE_URL;
        this.slackWebhookUrl = env.SLACK_WEBHOOK_URL;
        this.adminToken = env.ADMIN_TOKEN;
        this.rateLimitPerDay = env.RATE_LIMIT_PER_DAY;
    }
}
