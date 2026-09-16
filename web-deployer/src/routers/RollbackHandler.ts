import {Request, Response} from "express";
import {KeyObject} from "node:crypto";
import ILogger from "../services/ILogger";
import ISiteRegistry from "../services/ISiteRegistry";
import IDeployRunner from "../services/IDeployRunner";
import {MAX_ACTOR_LENGTH, SHA_REGEX} from "../consts/Consts";
import {sanitizeText} from "../utils/Sanitize";
import {readSignedRequest} from "../utils/SignedRequest";

export default class RollbackHandler {
    readonly #logger: ILogger;
    readonly #registry: ISiteRegistry;
    readonly #runner: IDeployRunner;
    readonly #publicKey: KeyObject;
    readonly #maxAgeMs: number;

    constructor(logger: ILogger, registry: ISiteRegistry, runner: IDeployRunner, publicKey: KeyObject, maxAgeMs: number) {
        this.#logger = logger.clone('[Rollback]');
        this.#registry = registry;
        this.#runner = runner;
        this.#publicKey = publicKey;
        this.#maxAgeMs = maxAgeMs;
    }

    handle = (req: Request, res: Response): void => {
        const request = readSignedRequest(this.#logger, this.#registry, this.#publicKey, this.#maxAgeMs, req, res);
        if (!request) return;

        const {site, body} = request;
        const commit = String(body.commit ?? '');
        if (!SHA_REGEX.test(commit)) {
            res.sendErr('BAD_COMMIT', 400);
            return;
        }

        const actor = sanitizeText(body.actor, MAX_ACTOR_LENGTH);
        if (!actor) {
            this.#logger.error(`site=${site.name} rollback to ${commit} carried no actor`);
            res.sendErr('MISSING_ACTOR', 400);
            return;
        }

        this.#runner.rollback(site, commit, actor);
        this.#logger.info(`site=${site.name} queued rollback to ${commit} by ${actor}`);
        res.status(202).json({queued: true, commit});
    };
}
