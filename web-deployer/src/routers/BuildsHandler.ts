import {Request, Response} from "express";
import ILogger from "../services/ILogger";
import ISiteRegistry from "../services/ISiteRegistry";
import IDeployStateStore from "../services/IDeployStateStore";
import IDeployRunner from "../services/IDeployRunner";
import {IBuildSnapshot} from "../services/IBuildSnapshot";
import {DeployStatus} from "../consts/Consts";

export default class BuildsHandler {
    readonly #logger: ILogger;
    readonly #registry: ISiteRegistry;
    readonly #store: IDeployStateStore;
    readonly #runner: IDeployRunner;

    constructor(logger: ILogger, registry: ISiteRegistry, store: IDeployStateStore, runner: IDeployRunner) {
        this.#logger = logger.clone('[Builds]');
        this.#registry = registry;
        this.#store = store;
        this.#runner = runner;
    }

    // Reachable only from the receiver's network, so it carries the error text.
    // The receiver strips that before anything public sees it.
    list = async (_req: Request, res: Response): Promise<void> => {
        try {
            const sites = await Promise.all(this.#registry.list().map(async site => {
                const history = await this.#store.history(site.name);
                const status: DeployStatus = this.#runner.isBuilding(site.name)
                    ? 'BUILDING'
                    : history[0]?.status ?? 'IDLE';

                return {...this.#registry.toPublic(site), status, history, backups: this.#runner.backups(site.name)};
            }));
            const snapshot: IBuildSnapshot = {sites};
            res.sendOk(snapshot);
        } catch (e) {
            this.#logger.error(`list failed: ${(e as Error).message}`);
            res.sendErr('INTERNAL', 500);
        }
    };
}
