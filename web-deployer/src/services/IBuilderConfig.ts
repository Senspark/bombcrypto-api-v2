export default interface IBuilderConfig {
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
}
