import {DeployStatus} from "../consts/Consts";

export interface IDeployState {
    site: string;
    status: DeployStatus;
    branch: string;
    commit: string;
    startedAt: number;
    finishedAt?: number;
    durationMs?: number;
    // Both come from the push payload, so both are sanitized on the way in.
    author?: string;
    commitMessage?: string;
    // Short reason, for Slack only. It carries build output, which is why it
    // never reaches the public dashboard. Full output stays in the log file.
    error?: string;
    logFile?: string;
}

export default interface IDeployStateStore {
    latest(site: string): Promise<IDeployState | null>;

    history(site: string): Promise<IDeployState[]>;

    // A run is identified by site plus startedAt: the same run is saved once
    // when it starts and again when it finishes, and must not appear twice.
    save(state: IDeployState): Promise<void>;
}
