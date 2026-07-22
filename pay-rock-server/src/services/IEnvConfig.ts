export default interface IEnvConfig {
    port: number;
    isProduction: boolean;

    databaseUrl: string;
    blockchainApi: string;

    redisUrl: string;
    previewTtlSeconds: number;
}
