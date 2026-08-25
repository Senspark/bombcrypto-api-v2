import {Request, Response} from "express";
import ILogger from "../services/ILogger";
import ISiteRegistry from "../services/ISiteRegistry";
import IBuildSnapshotSource from "../services/IBuildSnapshot";

export default class SitesHandler {
    readonly #logger: ILogger;
    readonly #registry: ISiteRegistry;
    readonly #builds: IBuildSnapshotSource;

    constructor(logger: ILogger, registry: ISiteRegistry, builds: IBuildSnapshotSource) {
        this.#logger = logger.clone('[Sites]');
        this.#registry = registry;
        this.#builds = builds;
    }

    // This page has no authentication, so it gets status and authorship only.
    // The error text is a tail of build output - internal paths, package names,
    // occasionally more - and stays in Slack and the log file.
    list = async (_req: Request, res: Response): Promise<void> => {
        try {
            const snapshot = this.#builds.current();
            const byName = new Map((snapshot?.sites ?? []).map(s => [s.name, s]));

            const sites = this.#registry.list().map(site => {
                const state = byName.get(site.name);
                return {
                    ...this.#registry.toPublic(site),
                    status: state?.status ?? 'IDLE',
                    history: (state?.history ?? []).map(run => ({
                        status: run.status,
                        commit: run.commit,
                        author: run.author ?? null,
                        commitMessage: run.commitMessage ?? null,
                        startedAt: run.startedAt,
                        finishedAt: run.finishedAt ?? null,
                        durationMs: run.durationMs ?? null,
                    })),
                };
            });
            res.sendOk({sites, builderReachable: this.#builds.reachable()});
        } catch (e) {
            this.#logger.error(`list failed: ${(e as Error).message}`);
            res.sendErr('INTERNAL', 500);
        }
    };
}
