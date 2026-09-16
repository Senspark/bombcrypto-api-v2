import {mkdirSync, readFileSync, renameSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import IDeployStateStore, {IDeployState} from "../services/IDeployStateStore";
import ILogger from "../services/ILogger";

export default class FileDeployStateStore implements IDeployStateStore {
    readonly #file: string;
    readonly #logger: ILogger;
    readonly #limit: number;
    #states: Record<string, IDeployState[]> = {};

    constructor(file: string, limit: number, logger: ILogger) {
        this.#file = file;
        this.#limit = limit;
        this.#logger = logger.clone('[State]');

        mkdirSync(dirname(file), {recursive: true});
        try {
            this.#states = this.#adopt(JSON.parse(readFileSync(file, 'utf8')));
        } catch (e) {
            // First boot has no file yet; a corrupt one costs only the history.
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
                this.#logger.error(`cannot read ${file}, starting empty: ${(e as Error).message}`);
            }
        }
    }

    async latest(site: string): Promise<IDeployState | null> {
        return this.#states[site]?.[0] ?? null;
    }

    async history(site: string): Promise<IDeployState[]> {
        return [...(this.#states[site] ?? [])];
    }

    async save(state: IDeployState): Promise<void> {
        const runs = this.#states[state.site] ?? [];
        const existing = runs.findIndex(r => r.startedAt === state.startedAt);
        if (existing >= 0) {
            runs[existing] = state;
        } else {
            runs.unshift(state);
        }
        this.#states[state.site] = runs.slice(0, this.#limit);

        const staged = join(dirname(this.#file), '.state.json.staged');
        try {
            writeFileSync(staged, JSON.stringify(this.#states, null, 2));
            renameSync(staged, this.#file);
        } catch (e) {
            // A lost status write must not fail the deploy that produced it.
            this.#logger.error(`save failed site=${state.site} status=${state.status}: ${(e as Error).message}`);
        }
    }

    // The file used to hold one state per site instead of a list. Reading that
    // shape keeps the deployed history across the upgrade instead of dropping it.
    #adopt(parsed: unknown): Record<string, IDeployState[]> {
        const states: Record<string, IDeployState[]> = {};
        if (!parsed || typeof parsed !== 'object') return states;

        for (const [site, value] of Object.entries(parsed as Record<string, unknown>)) {
            if (Array.isArray(value)) {
                states[site] = (value as IDeployState[]).slice(0, this.#limit);
            } else if (value && typeof value === 'object') {
                states[site] = [value as IDeployState];
            }
        }
        return states;
    }
}
