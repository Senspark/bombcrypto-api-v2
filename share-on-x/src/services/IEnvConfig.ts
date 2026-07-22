export default interface IEnvConfig {
    port: number;
    isProduction: boolean;
    redisConnectionString: string;
    // Postgres connection for the durable analytics store. Empty disables it.
    databaseUrl: string;
    shareBaseUrl: string;
    // Full base for og:image (may be a different host); image URL = `${imageUrlBase}/${id}.jpg`.
    imageUrlBase: string;
    imageDir: string;
    shareTtlSeconds: number;
    imageMaxBytes: number;
    corsOrigins: string[];
    // host:port only; verify path is hardcoded in ApLoginAuthVerifier.
    apLoginBaseUrl: string;
    slackWebhookUrl: string;
    adminToken: string;
    rateLimitPerDay: number;
}
