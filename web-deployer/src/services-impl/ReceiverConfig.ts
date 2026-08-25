import 'dotenv/config'
import {cleanEnv, num, port, str, url} from 'envalid';
import IReceiverConfig from "../services/IReceiverConfig";
import {HookIpMode} from "../services/IHookIpFilter";

export default class ReceiverConfig implements IReceiverConfig {
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

    constructor() {
        const env = cleanEnv(process.env, {
            PORT: port({default: 8111}),

            SITES_FILE: str({default: '/config/sites.json'}),

            BUILDER_URL: url(),
            BUILDER_TIMEOUT_MS: num({default: 10 * 1000}),
            TRIGGER_PRIVATE_KEY: str(),

            POLL_INTERVAL_MS: num({default: 5 * 1000}),
            // Optional: without it the deployer behaves exactly as before, silently.
            SLACK_WEBHOOK_URL: str({default: ''}),
            // Where this dashboard is reachable. Only the notification footer
            // uses it, so it stays out of the code that serves the page.
            DASHBOARD_URL: str({default: ''}),

            // Starts in 'log' on purpose: an allowlist that silently drops real
            // webhooks is worse than none, so watch what it would have rejected
            // before switching it to 'enforce'.
            HOOK_IP_MODE: str({choices: ['off', 'log', 'enforce'], default: 'log'}),
            GITHUB_META_URL: str({default: 'https://api.github.com/meta'}),
            GITHUB_META_REFRESH_MS: num({default: 6 * 60 * 60 * 1000}),
        });

        this.port = env.PORT;
        this.sitesFile = env.SITES_FILE;

        this.builderUrl = env.BUILDER_URL.replace(/\/+$/, '');
        this.builderTimeoutMs = env.BUILDER_TIMEOUT_MS;
        this.triggerPrivateKey = env.TRIGGER_PRIVATE_KEY;

        this.pollIntervalMs = env.POLL_INTERVAL_MS;
        this.slackWebhookUrl = env.SLACK_WEBHOOK_URL;
        this.dashboardUrl = env.DASHBOARD_URL;

        this.hookIpMode = env.HOOK_IP_MODE as HookIpMode;
        this.githubMetaUrl = env.GITHUB_META_URL;
        this.githubMetaRefreshMs = env.GITHUB_META_REFRESH_MS;
    }
}
