import {HookIpMode} from "./IHookIpFilter";

export default interface IReceiverConfig {
    port: number;

    sitesFile: string;

    builderUrl: string;
    builderTimeoutMs: number;
    triggerPrivateKey: string;

    pollIntervalMs: number;
    slackWebhookUrl: string;
    dashboardUrl: string;

    hookIpMode: HookIpMode;
    githubMetaUrl: string;
    githubMetaRefreshMs: number;
}
