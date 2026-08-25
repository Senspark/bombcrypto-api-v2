import {ISite} from "./ISiteRegistry";

export interface IDeployMeta {
    author?: string;
    commitMessage?: string;
}

export default interface IDeployRunner {
    // Fire-and-forget. Only one deploy runs at a time across every site; a site
    // triggered while busy keeps just its newest commit, so a burst of pushes
    // builds once instead of once per push.
    trigger(site: ISite, commit: string, meta: IDeployMeta): void;

    isBuilding(site: string): boolean;
}
