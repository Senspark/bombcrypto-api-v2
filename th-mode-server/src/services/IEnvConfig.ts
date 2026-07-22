export default interface IEnvConfig {
    port: number;
    isProduction: boolean;
    refreshIntervalMs: number;
    redisConnectionString: string;
    databaseUrl: string;
    useMockData: boolean;

    clientThModePath: string;
}
