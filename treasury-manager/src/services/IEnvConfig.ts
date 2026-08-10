export default interface IEnvConfig {
    isProduction: boolean;
    port: number;
    appVersion: string;

    /** Google Sign-In gate. When false every request is treated as an authenticated local operator. */
    authEnabled: boolean;
    googleClientId: string;
    allowedEmailDomain: string;
    sessionTtlSeconds: number;

    redisConnectionString: string;

    /** Manager EOA holding WITHDRAWER_ROLE on the six treasury proxies. */
    managerPrivateKey: string;

    rpcByChainId: Record<number, string>;

    tickIntervalMs: number;
    /** Native balance below which the manager wallet is considered unable to pay gas. */
    minNativeBalance: string;
}
