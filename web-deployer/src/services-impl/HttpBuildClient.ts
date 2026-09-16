import {KeyObject} from "node:crypto";
import IBuildClient from "../services/IBuildClient";
import {IBuildSnapshot} from "../services/IBuildSnapshot";
import {IDeployMeta} from "../services/IDeployRunner";
import ILogger from "../services/ILogger";
import {signTrigger} from "../utils/TriggerSignature";
import {TRIGGER_SIGNATURE_HEADER} from "../consts/Consts";

export default class HttpBuildClient implements IBuildClient {
    readonly #logger: ILogger;
    readonly #baseUrl: string;
    readonly #timeoutMs: number;
    readonly #privateKey: KeyObject;

    constructor(logger: ILogger, baseUrl: string, timeoutMs: number, privateKey: KeyObject) {
        this.#logger = logger.clone('[Builder]');
        this.#baseUrl = baseUrl;
        this.#timeoutMs = timeoutMs;
        this.#privateKey = privateKey;
    }

    async trigger(siteName: string, commit: string, meta: IDeployMeta): Promise<void> {
        await this.#post('trigger', {
            site: siteName,
            commit,
            author: meta.author,
            commitMessage: meta.commitMessage,
        });
        this.#logger.info(`site=${siteName} commit=${commit} accepted by builder`);
    }

    async previewPr(siteName: string, prNumber: number, actor: string): Promise<void> {
        await this.#post('preview', {site: siteName, prNumber, actor});
        this.#logger.info(`site=${siteName} preview of PR #${prNumber} by ${actor} accepted by builder`);
    }

    async rollback(siteName: string, commit: string, actor: string): Promise<void> {
        await this.#post('rollback', {site: siteName, commit, actor});
        this.#logger.info(`site=${siteName} rollback to ${commit} by ${actor} accepted by builder`);
    }

    async #post(path: string, payload: Record<string, unknown>): Promise<void> {
        // The signature covers these exact bytes, so the same buffer is both
        // signed and sent - re-serialising would invalidate it.
        const body = Buffer.from(JSON.stringify({...payload, issuedAt: Date.now()}));

        const res = await fetch(`${this.#baseUrl}/api/${path}`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                [TRIGGER_SIGNATURE_HEADER]: signTrigger(this.#privateKey, body),
            },
            body,
            signal: AbortSignal.timeout(this.#timeoutMs),
        });
        if (!res.ok) {
            throw new Error(`builder answered ${res.status} to ${path} site=${payload.site}`);
        }
    }

    async snapshot(): Promise<IBuildSnapshot> {
        const res = await fetch(`${this.#baseUrl}/api/builds`, {
            signal: AbortSignal.timeout(this.#timeoutMs),
        });
        if (!res.ok) {
            throw new Error(`builder answered ${res.status} to builds`);
        }
        return await res.json() as IBuildSnapshot;
    }
}
