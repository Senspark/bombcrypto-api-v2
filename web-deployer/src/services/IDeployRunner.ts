import {ISite} from "./ISiteRegistry";

export interface IDeployMeta {
    author?: string;
    commitMessage?: string;
    actor?: string;
}

export default interface IDeployRunner {
    // Fire-and-forget. Only one operation runs at a time across every site; a
    // site triggered while busy keeps just its newest commit, so a burst of
    // pushes builds once instead of once per push.
    trigger(site: ISite, commit: string, meta: IDeployMeta): void;

    // Builds a pull request head into the preview directory. The commit is not
    // known here - the builder resolves it after fetching the pull request ref.
    previewPr(site: ISite, prNumber: number, actor: string): void;

    rollback(site: ISite, commit: string, actor: string): void;

    isBuilding(site: string): boolean;

    // Commits still restorable for a site, newest first.
    backups(siteName: string): string[];
}
