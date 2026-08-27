import 'dotenv/config'
import {cleanEnv, num, port, str} from 'envalid';
import IBuilderConfig from "../services/IBuilderConfig";

export default class BuilderConfig implements IBuilderConfig {
    port: number;

    sitesFile: string;
    reposDir: string;
    logsDir: string;
    stateFile: string;
    backupDir: string;
    backupKeep: number;

    triggerPublicKey: string;
    triggerMaxAgeMs: number;

    historyLimit: number;
    gitTimeoutMs: number;
    buildTimeoutMs: number;
    publishTimeoutMs: number;
    logTailLines: number;

    constructor() {
        const env = cleanEnv(process.env, {
            PORT: port({default: 8112}),

            SITES_FILE: str({default: '/config/sites.json'}),
            REPOS_DIR: str({default: '/data/repos'}),
            LOGS_DIR: str({default: '/data/logs'}),
            STATE_FILE: str({default: '/data/logs/state.json'}),
            BACKUP_DIR: str({default: '/data/backup'}),
            BACKUP_KEEP: num({default: 10}),

            TRIGGER_PUBLIC_KEY: str(),
            TRIGGER_MAX_AGE_MS: num({default: 60 * 1000}),

            HISTORY_LIMIT: num({default: 20}),
            GIT_TIMEOUT_MS: num({default: 5 * 60 * 1000}),
            BUILD_TIMEOUT_MS: num({default: 15 * 60 * 1000}),
            PUBLISH_TIMEOUT_MS: num({default: 5 * 60 * 1000}),
            LOG_TAIL_LINES: num({default: 20}),
        });

        this.port = env.PORT;
        this.sitesFile = env.SITES_FILE;
        this.reposDir = env.REPOS_DIR;
        this.logsDir = env.LOGS_DIR;
        this.stateFile = env.STATE_FILE;
        this.backupDir = env.BACKUP_DIR;
        this.backupKeep = env.BACKUP_KEEP;

        this.triggerPublicKey = env.TRIGGER_PUBLIC_KEY;
        this.triggerMaxAgeMs = env.TRIGGER_MAX_AGE_MS;

        this.historyLimit = env.HISTORY_LIMIT;
        this.gitTimeoutMs = env.GIT_TIMEOUT_MS;
        this.buildTimeoutMs = env.BUILD_TIMEOUT_MS;
        this.publishTimeoutMs = env.PUBLISH_TIMEOUT_MS;
        this.logTailLines = env.LOG_TAIL_LINES;
    }
}
