import {DeployStatus} from "../consts/Consts";
import {IDeployState} from "./IDeployStateStore";

export interface IBuildSiteState {
    name: string;
    repo: string;
    branch: string;
    url?: string;
    status: DeployStatus;
    history: IDeployState[];
}

export interface IBuildSnapshot {
    sites: IBuildSiteState[];
}

export default interface IBuildSnapshotSource {
    // Null until the first poll succeeds.
    current(): IBuildSnapshot | null;

    reachable(): boolean;
}
