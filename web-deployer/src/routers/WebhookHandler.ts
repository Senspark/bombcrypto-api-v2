import {Request, Response} from "express";
import ILogger from "../services/ILogger";
import ISiteRegistry from "../services/ISiteRegistry";
import ISecretStore from "../services/ISecretStore";
import IBuildClient from "../services/IBuildClient";
import {verifyGithubSignature} from "../utils/Signature";
import {
    MAX_AUTHOR_LENGTH,
    MAX_COMMIT_MESSAGE_LENGTH,
    PREVIEW_COMMAND,
    PREVIEW_ROLES,
    SHA_REGEX,
} from "../consts/Consts";
import {sanitizeText} from "../utils/Sanitize";

export default class WebhookHandler {
    readonly #logger: ILogger;
    readonly #registry: ISiteRegistry;
    readonly #secrets: ISecretStore;
    readonly #builder: IBuildClient;

    constructor(logger: ILogger, registry: ISiteRegistry, secrets: ISecretStore, builder: IBuildClient) {
        this.#logger = logger.clone('[Hook]');
        this.#registry = registry;
        this.#secrets = secrets;
        this.#builder = builder;
    }

    handle = async (req: Request, res: Response): Promise<void> => {
        const siteName = String(req.params.site ?? '');
        const site = this.#registry.get(siteName);
        if (!site) {
            this.#logger.error(`unknown site "${siteName}"`);
            res.sendErr('UNKNOWN_SITE', 404);
            return;
        }

        const rawBody = req.rawBody;
        if (!rawBody) {
            this.#logger.error(`site=${siteName} missing raw body`);
            res.sendErr('BAD_REQUEST', 400);
            return;
        }

        if (!verifyGithubSignature(this.#secrets.get(siteName), rawBody, req.header('x-hub-signature-256'))) {
            this.#logger.error(`site=${siteName} invalid signature from ${req.ip}`);
            res.sendErr('INVALID_SIGNATURE', 401);
            return;
        }

        const event = req.header('x-github-event');
        if (event === 'ping') {
            this.#logger.info(`site=${siteName} ping ok`);
            res.sendOk({pong: true});
            return;
        }
        const body = req.body ?? {};
        if (event === 'issue_comment') {
            await this.#handleComment(siteName, body, res);
            return;
        }
        if (event !== 'push') {
            this.#logger.info(`site=${siteName} ignoring event "${event}"`);
            res.status(204).end();
            return;
        }

        if (body.ref !== `refs/heads/${site.branch}`) {
            this.#logger.info(`site=${siteName} ignoring ref "${body.ref}" (want ${site.branch})`);
            res.status(204).end();
            return;
        }
        if (body.deleted === true) {
            this.#logger.info(`site=${siteName} ignoring branch deletion`);
            res.status(204).end();
            return;
        }

        const commit = String(body.after ?? '');
        if (!SHA_REGEX.test(commit)) {
            this.#logger.error(`site=${siteName} bad commit "${commit}"`);
            res.sendErr('BAD_COMMIT', 400);
            return;
        }

        try {
            await this.#builder.trigger(siteName, commit, this.#readAuthorship(body));
        } catch (e) {
            this.#logger.error(`site=${siteName} commit=${commit} cannot reach builder: ${(e as Error).message}`);
            res.sendErr('BUILDER_UNAVAILABLE', 502);
            return;
        }

        this.#logger.info(`site=${siteName} queued commit=${commit}`);
        // GitHub gives up after 10s; the build takes far longer than that.
        res.status(202).json({queued: true, commit});
    };

    // A comment asking for a preview build. Building a pull request head runs
    // code nobody has merged, so the gate is who wrote the comment: GitHub
    // states the commenter's association with the repository, and the payload
    // carrying it is signed. CONTRIBUTOR is not on the list - it only means the
    // author has had a pull request merged before, which is not a role.
    async #handleComment(siteName: string, body: any, res: Response): Promise<void> {
        if (body.action !== 'created' || !body.issue?.pull_request) {
            res.status(204).end();
            return;
        }

        const text = String(body.comment?.body ?? '');
        if (!text.split('\n').some(line => line.trim() === PREVIEW_COMMAND)) {
            res.status(204).end();
            return;
        }

        const association = String(body.comment?.author_association ?? '');
        const commenter = sanitizeText(body.comment?.user?.login, MAX_AUTHOR_LENGTH);
        if (!PREVIEW_ROLES.includes(association)) {
            this.#logger.error(`site=${siteName} refusing ${PREVIEW_COMMAND} from ${commenter ?? 'unknown'} (association=${association})`);
            res.status(403).json({error: 'FORBIDDEN_ROLE'});
            return;
        }

        const prNumber = Number(body.issue?.number);
        if (!Number.isSafeInteger(prNumber) || prNumber <= 0) {
            this.#logger.error(`site=${siteName} bad pull request number "${body.issue?.number}"`);
            res.sendErr('BAD_PR_NUMBER', 400);
            return;
        }

        try {
            await this.#builder.previewPr(siteName, prNumber, commenter ?? association);
        } catch (e) {
            this.#logger.error(`site=${siteName} PR #${prNumber} cannot reach builder: ${(e as Error).message}`);
            res.sendErr('BUILDER_UNAVAILABLE', 502);
            return;
        }

        this.#logger.info(`site=${siteName} queued preview of PR #${prNumber} asked by ${commenter} (${association})`);
        res.status(202).json({queued: true, prNumber});
    }

    // The only payload fields beyond ref and after that are read at all. They are
    // display text controlled by whoever wrote the commit, so they are flattened
    // and length-capped here, before they can reach a page, a channel or a log.
    #readAuthorship(body: any): {author?: string, commitMessage?: string} {
        const head = body.head_commit ?? {};
        return {
            author: sanitizeText(head.author?.username ?? head.author?.name ?? body.pusher?.name, MAX_AUTHOR_LENGTH),
            commitMessage: sanitizeText(head.message, MAX_COMMIT_MESSAGE_LENGTH),
        };
    }
}
