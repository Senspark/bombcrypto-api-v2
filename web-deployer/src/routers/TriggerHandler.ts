import {Request, Response} from "express";
import {KeyObject} from "node:crypto";
import ILogger from "../services/ILogger";
import ISiteRegistry from "../services/ISiteRegistry";
import IDeployRunner from "../services/IDeployRunner";
import {MAX_AUTHOR_LENGTH, MAX_COMMIT_MESSAGE_LENGTH, SHA_REGEX} from "../consts/Consts";
import {sanitizeText} from "../utils/Sanitize";
import {readSignedRequest} from "../utils/SignedRequest";

export default class TriggerHandler {
    readonly #logger: ILogger;
    readonly #registry: ISiteRegistry;
    readonly #runner: IDeployRunner;
    readonly #publicKey: KeyObject;
    readonly #maxAgeMs: number;

    constructor(logger: ILogger, registry: ISiteRegistry, runner: IDeployRunner, publicKey: KeyObject, maxAgeMs: number) {
        this.#logger = logger.clone('[Trigger]');
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

        this.#runner.trigger(site, commit, {
            author: sanitizeText(body.author, MAX_AUTHOR_LENGTH),
            commitMessage: sanitizeText(body.commitMessage, MAX_COMMIT_MESSAGE_LENGTH),
        });
        this.#logger.info(`site=${site.name} queued commit=${commit}`);
        res.status(202).json({queued: true, commit});
    };
}
