import {Request, Response} from "express";
import ILogger from "../services/ILogger";
import ISiteRegistry from "../services/ISiteRegistry";
import IBuildClient from "../services/IBuildClient";
import {SHA_REGEX} from "../consts/Consts";

// Rollback is the one button left that writes production: a merge into the
// deploy branch is what puts anything there in the first place. It sits behind
// the auth middleware, and the email that resolved is what the builder records
// as the actor - never a value from the request body.
export default class ReleaseHandler {
    readonly #logger: ILogger;
    readonly #registry: ISiteRegistry;
    readonly #builder: IBuildClient;

    constructor(logger: ILogger, registry: ISiteRegistry, builder: IBuildClient) {
        this.#logger = logger.clone('[Release]');
        this.#registry = registry;
        this.#builder = builder;
    }

    rollback = async (req: Request, res: Response): Promise<void> => {
        await this.#forward('rollback', req, res, (name, commit, actor) => this.#builder.rollback(name, commit, actor));
    };

    async #forward(
        action: string,
        req: Request,
        res: Response,
        send: (siteName: string, commit: string, actor: string) => Promise<void>,
    ): Promise<void> {
        const site = this.#registry.get(String(req.params.site ?? ''));
        if (!site) {
            this.#logger.error(`${action} for unknown site "${req.params.site}"`);
            res.sendErr('UNKNOWN_SITE', 404);
            return;
        }

        const commit = String(req.body?.commit ?? '');
        if (!SHA_REGEX.test(commit)) {
            res.sendErr('BAD_COMMIT', 400);
            return;
        }

        const actor = String(res.locals.actor);
        try {
            await send(site.name, commit, actor);
        } catch (e) {
            this.#logger.error(`site=${site.name} ${action} of ${commit} by ${actor} was not accepted: ${(e as Error).message}`);
            res.sendErr('BUILDER_UNREACHABLE', 502);
            return;
        }

        this.#logger.info(`site=${site.name} ${action} of ${commit} requested by ${actor}`);
        res.status(202).json({queued: true, commit});
    }
}
