import {Request, Response, Router} from "express";
import {ClientErrors, isNativeNetwork} from "../consts/Consts.js";
import ILogger from "../services/ILogger.js";
import NativeStatsService from "../services-impl/NativeStatsService.js";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

export default function buildNativeStatsRouter(logger: ILogger, stats: NativeStatsService): Router {
    const log = logger.clone("[NativeApi]");
    const router = Router();

    const wrap =
        (fn: (req: Request, res: Response) => Promise<unknown>) =>
        (req: Request, res: Response): void => {
            fn(req, res).catch((e) => {
                log.error(e);
                if (!res.headersSent) res.status(500).json({error: ClientErrors.INTERNAL});
            });
        };

    router.get(
        "/summary",
        wrap(async (req, res) => {
            const network = req.query.network;
            if (!isNativeNetwork(network)) {
                res.status(400).json({error: ClientErrors.INVALID_NETWORK});
                return;
            }
            res.json(await stats.summary(network));
        }),
    );

    router.get(
        "/daily",
        wrap(async (req, res) => {
            const network = req.query.network;
            if (!isNativeNetwork(network)) {
                res.status(400).json({error: ClientErrors.INVALID_NETWORK});
                return;
            }
            const days = parseDays(req.query.days);
            res.json({points: await stats.daily(network, days)});
        }),
    );

    router.get(
        "/excluded-uids",
        wrap(async (_req, res) => {
            res.json({uids: await stats.excludedUids()});
        }),
    );

    // Whole-list replace rather than add/remove: the operator edits what they can see, and a partial
    // update would need them to know the current contents to reason about the result.
    router.put(
        "/excluded-uids",
        wrap(async (req, res) => {
            const uids = parseUids(req.body?.uids);
            if (!uids) {
                res.status(400).json({error: ClientErrors.INVALID_UIDS});
                return;
            }
            const saved = await stats.setExcludedUids(uids);
            log.info(`excluded uids set to [${saved.join(", ")}] by ${res.locals.operator}`);
            res.json({uids: saved});
        }),
    );

    return router;
}

function parseDays(raw: unknown): number {
    const days = Number(raw);
    if (!Number.isFinite(days) || days <= 0) return DEFAULT_DAYS;
    return Math.min(Math.floor(days), MAX_DAYS);
}

function parseUids(raw: unknown): number[] | null {
    if (!Array.isArray(raw)) return null;
    const uids = raw.map(Number);
    if (uids.some((uid) => !Number.isInteger(uid) || uid <= 0)) return null;
    return uids;
}
