import {DeployKind, DeployStatus} from "../consts/Consts";

export interface IDeployState {
    site: string;
    kind: DeployKind;
    status: DeployStatus;
    branch: string;
    // Empty on a pr build until the pull request head has been fetched - the
    // comment that asked for it names a pull request, not a commit.
    commit: string;
    prNumber?: number;
    startedAt: number;
    finishedAt?: number;
    durationMs?: number;
    // Both come from the push payload, so both are sanitized on the way in.
    author?: string;
    commitMessage?: string;
    // Who asked for it: the commenter for a pr build, the signed-in email for a
    // rollback.
    actor?: string;
    // Short reason, for Slack only. It carries build output, which is why it
    // never reaches the public dashboard. Full output stays in the log file.
    error?: string;
    // Set on an operation that succeeded with something worth saying anyway.
    warning?: string;
    logFile?: string;
}

export default interface IDeployStateStore {
    latest(site: string): Promise<IDeployState | null>;

    history(site: string): Promise<IDeployState[]>;

    // A run is identified by site plus startedAt: the same run is saved once
    // when it starts and again when it finishes, and must not appear twice.
    save(state: IDeployState): Promise<void>;
}
