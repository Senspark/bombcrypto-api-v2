import {Request, Response} from "express";
import {KeyObject} from "node:crypto";
import ILogger from "../services/ILogger";
import ISiteRegistry from "../services/ISiteRegistry";
import IDeployRunner from "../services/IDeployRunner";
import {MAX_ACTOR_LENGTH} from "../consts/Consts";
import {sanitizeText} from "../utils/Sanitize";
import {readSignedRequest} from "../utils/SignedRequest";

// Builds a pull request head into preview. The receiver has already checked
// that a maintainer asked for it; this end only refuses what it can see.
export default class PreviewHandler {
    readonly #logger: ILogger;
    readonly #registry: ISiteRegistry;
    readonly #runner: IDeployRunner;
    readonly #publicKey: KeyObject;
    readonly #maxAgeMs: number;

    constructor(logger: ILogger, registry: ISiteRegistry, runner: IDeployRunner, publicKey: KeyObject, maxAgeMs: number) {
        this.#logger = logger.clone('[Preview]');
        this.#registry = registry;
        this.#runner = runner;
        this.#publicKey = publicKey;
        this.#maxAgeMs = maxAgeMs;
    }

    handle = (req: Request, res: Response): void => {
        const request = readSignedRequest(this.#logger, this.#registry, this.#publicKey, this.#maxAgeMs, req, res);
        if (!request) return;

        const {site, body} = request;
        const prNumber = Number(body.prNumber);
        // It becomes a path segment in a git ref, so nothing but a positive
        // integer may get through.
        if (!Number.isSafeInteger(prNumber) || prNumber <= 0) {
            this.#logger.error(`site=${site.name} bad pull request number "${body.prNumber}"`);
            res.sendErr('BAD_PR_NUMBER', 400);
            return;
        }

        const actor = sanitizeText(body.actor, MAX_ACTOR_LENGTH);
        if (!actor) {
            this.#logger.error(`site=${site.name} preview of PR #${prNumber} carried no actor`);
            res.sendErr('MISSING_ACTOR', 400);
            return;
        }

        this.#runner.previewPr(site, prNumber, actor);
        this.#logger.info(`site=${site.name} queued preview of PR #${prNumber} by ${actor}`);
        res.status(202).json({queued: true, prNumber});
    };
}
