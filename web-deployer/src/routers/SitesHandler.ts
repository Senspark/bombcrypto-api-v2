import {Request, Response} from "express";
import ILogger from "../services/ILogger";
import ISiteRegistry from "../services/ISiteRegistry";
import IBuildSnapshotSource from "../services/IBuildSnapshot";

export default class SitesHandler {
    readonly #logger: ILogger;
    readonly #registry: ISiteRegistry;
    readonly #builds: IBuildSnapshotSource;
    readonly #googleClientId: string;

    constructor(logger: ILogger, registry: ISiteRegistry, builds: IBuildSnapshotSource, googleClientId: string) {
        this.#logger = logger.clone('[Sites]');
        this.#registry = registry;
        this.#builds = builds;
        // Public by nature - the page has to hand it to Google to sign anyone in.
        this.#googleClientId = googleClientId;
    }

    // This page has no authentication, so it gets status and authorship only.
    // The error text is a tail of build output - internal paths, package names,
    // occasionally more - and stays in Slack and the log file. Every field here
    // is listed one by one for that reason; nothing is spread in from a state.
    list = async (_req: Request, res: Response): Promise<void> => {
        try {
            const snapshot = this.#builds.current();
            const byName = new Map((snapshot?.sites ?? []).map(s => [s.name, s]));

            const sites = this.#registry.list().map(site => {
                const state = byName.get(site.name);
                return {
                    ...this.#registry.toPublic(site),
                    status: state?.status ?? 'IDLE',
                    backups: state?.backups ?? [],
                    history: (state?.history ?? []).map(run => ({
                        kind: run.kind ?? 'build',
                        status: run.status,
                        actor: run.actor ?? null,
                        prNumber: run.prNumber ?? null,
                        commit: run.commit,
                        author: run.author ?? null,
                        commitMessage: run.commitMessage ?? null,
                        startedAt: run.startedAt,
                        finishedAt: run.finishedAt ?? null,
                        durationMs: run.durationMs ?? null,
                    })),
                };
            });
            res.sendOk({sites, builderReachable: this.#builds.reachable(), googleClientId: this.#googleClientId});
        } catch (e) {
            this.#logger.error(`list failed: ${(e as Error).message}`);
            res.sendErr('INTERNAL', 500);
        }
    };
}
