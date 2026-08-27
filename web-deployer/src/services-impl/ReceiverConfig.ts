import 'dotenv/config'
import {cleanEnv, num, port, str, url} from 'envalid';
import IReceiverConfig from "../services/IReceiverConfig";
import {HookIpMode} from "../services/IHookIpFilter";

export default class ReceiverConfig implements IReceiverConfig {
    port: number;
    isProduction: boolean;

    sitesFile: string;

    builderUrl: string;
    builderTimeoutMs: number;
    triggerPrivateKey: string;

    pollIntervalMs: number;
    slackWebhookUrl: string;
    dashboardUrl: string;

    googleClientId: string;
    allowedEmailDomain: string;
    sessionTtlSeconds: number;

    hookIpMode: HookIpMode;
    githubMetaUrl: string;
    githubMetaRefreshMs: number;

    constructor() {
        const env = cleanEnv(process.env, {
            PORT: port({default: 8111}),
            NODE_ENV: str({choices: ['development', 'production'], default: 'production'}),

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

            // Empty turns authentication off and treats every caller as an
            // operator. Development only: rollback is then open to anyone who
            // can reach the dashboard.
            GOOGLE_CLIENT_ID: str({default: ''}),
            ALLOWED_EMAIL_DOMAIN: str({default: ''}),
            SESSION_TTL_SECONDS: num({default: 12 * 60 * 60}),

            // Starts in 'log' on purpose: an allowlist that silently drops real
            // webhooks is worse than none, so watch what it would have rejected
            // before switching it to 'enforce'.
            HOOK_IP_MODE: str({choices: ['off', 'log', 'enforce'], default: 'log'}),
            GITHUB_META_URL: str({default: 'https://api.github.com/meta'}),
            GITHUB_META_REFRESH_MS: num({default: 6 * 60 * 60 * 1000}),
        });

        this.port = env.PORT;
        this.isProduction = env.NODE_ENV === 'production';
        this.sitesFile = env.SITES_FILE;

        this.builderUrl = env.BUILDER_URL.replace(/\/+$/, '');
        this.builderTimeoutMs = env.BUILDER_TIMEOUT_MS;
        this.triggerPrivateKey = env.TRIGGER_PRIVATE_KEY;

        this.pollIntervalMs = env.POLL_INTERVAL_MS;
        this.slackWebhookUrl = env.SLACK_WEBHOOK_URL;
        this.dashboardUrl = env.DASHBOARD_URL;

        this.googleClientId = env.GOOGLE_CLIENT_ID;
        this.allowedEmailDomain = env.ALLOWED_EMAIL_DOMAIN;
        this.sessionTtlSeconds = env.SESSION_TTL_SECONDS;

        if (this.googleClientId && !this.allowedEmailDomain) {
            throw new Error('GOOGLE_CLIENT_ID is set but ALLOWED_EMAIL_DOMAIN is empty: every Google account would be accepted');
        }

        this.hookIpMode = env.HOOK_IP_MODE as HookIpMode;
        this.githubMetaUrl = env.GITHUB_META_URL;
        this.githubMetaRefreshMs = env.GITHUB_META_REFRESH_MS;
    }
}
