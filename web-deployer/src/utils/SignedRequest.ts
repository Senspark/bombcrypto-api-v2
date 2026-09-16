import {Request, Response} from "express";
import {KeyObject} from "node:crypto";
import ILogger from "../services/ILogger";
import ISiteRegistry, {ISite} from "../services/ISiteRegistry";
import {TRIGGER_SIGNATURE_HEADER} from "../consts/Consts";
import {verifyTrigger} from "./TriggerSignature";

export interface ISignedRequest {
    site: ISite;
    body: Record<string, any>;
}

// Everything the builder accepts arrives the same way: signed by the receiver
// and naming a site. What else the body has to carry differs per handler. On
// rejection this answers the request itself and returns null.
export function readSignedRequest(
    logger: ILogger,
    registry: ISiteRegistry,
    publicKey: KeyObject,
    maxAgeMs: number,
    req: Request,
    res: Response,
): ISignedRequest | null {
    const rawBody = req.rawBody;
    if (!rawBody) {
        res.sendErr('BAD_REQUEST', 400);
        return null;
    }

    const signature = req.header(TRIGGER_SIGNATURE_HEADER);
    if (!verifyTrigger(publicKey, rawBody, signature)) {
        logger.error(`unsigned request from ${req.ip}`);
        res.sendErr('INVALID_SIGNATURE', 401);
        return null;
    }

    const body = req.body ?? {};

    // A build can read this container's memory and disk, so it can capture a
    // signed request as it arrives. Without an expiry it could replay that
    // request later to put an older commit back on the live site.
    const issuedAt = Number(body.issuedAt);
    if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > maxAgeMs) {
        logger.error(`stale request issuedAt=${body.issuedAt}`);
        res.sendErr('STALE_TRIGGER', 400);
        return null;
    }

    const site = registry.get(String(body.site ?? ''));
    if (!site) {
        logger.error(`unknown site "${body.site}"`);
        res.sendErr('UNKNOWN_SITE', 404);
        return null;
    }

    return {site, body};
}
