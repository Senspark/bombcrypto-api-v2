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
        // The signature covers these exact bytes, so the same buffer is both
        // signed and sent - re-serialising would invalidate it.
        const body = Buffer.from(JSON.stringify({
            site: siteName,
            commit,
            author: meta.author,
            commitMessage: meta.commitMessage,
            issuedAt: Date.now(),
        }));

        const res = await fetch(`${this.#baseUrl}/api/trigger`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                [TRIGGER_SIGNATURE_HEADER]: signTrigger(this.#privateKey, body),
            },
            body,
            signal: AbortSignal.timeout(this.#timeoutMs),
        });
        if (!res.ok) {
            throw new Error(`builder answered ${res.status} to trigger site=${siteName}`);
        }
        this.#logger.info(`site=${siteName} commit=${commit} accepted by builder`);
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
