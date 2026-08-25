import {Request, Response} from "express";
import {KeyObject} from "node:crypto";
import ILogger from "../services/ILogger";
import ISiteRegistry from "../services/ISiteRegistry";
import IDeployRunner from "../services/IDeployRunner";
import {verifyTrigger} from "../utils/TriggerSignature";
import {MAX_AUTHOR_LENGTH, MAX_COMMIT_MESSAGE_LENGTH, SHA_REGEX, TRIGGER_SIGNATURE_HEADER} from "../consts/Consts";
import {sanitizeText} from "../utils/Sanitize";

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
        const rawBody = req.rawBody;
        if (!rawBody) {
            res.sendErr('BAD_REQUEST', 400);
            return;
        }

        const signature = req.header(TRIGGER_SIGNATURE_HEADER);
        if (!verifyTrigger(this.#publicKey, rawBody, signature)) {
            this.#logger.error(`unsigned trigger from ${req.ip}`);
            res.sendErr('INVALID_SIGNATURE', 401);
            return;
        }

        const body = req.body ?? {};

        // A build can read this container's memory and disk, so it can capture a
        // signed trigger as it arrives. Without an expiry it could replay that
        // trigger later to roll a site back to an older commit.
        const issuedAt = Number(body.issuedAt);
        if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > this.#maxAgeMs) {
            this.#logger.error(`stale trigger issuedAt=${body.issuedAt}`);
            res.sendErr('STALE_TRIGGER', 400);
            return;
        }

        const site = this.#registry.get(String(body.site ?? ''));
        if (!site) {
            this.#logger.error(`unknown site "${body.site}"`);
            res.sendErr('UNKNOWN_SITE', 404);
            return;
        }

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
