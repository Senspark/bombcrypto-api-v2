import {HookIpMode} from "./IHookIpFilter";

export default interface IReceiverConfig {
    port: number;
    isProduction: boolean;

    sitesFile: string;

    builderUrl: string;
    builderTimeoutMs: number;
    triggerPrivateKey: string;

    pollIntervalMs: number;
    slackWebhookUrl: string;
    dashboardUrl: string;

    // Empty disables authentication entirely, for local development only.
    googleClientId: string;
    allowedEmailDomain: string;
    sessionTtlSeconds: number;

    hookIpMode: HookIpMode;
    githubMetaUrl: string;
    githubMetaRefreshMs: number;
}
