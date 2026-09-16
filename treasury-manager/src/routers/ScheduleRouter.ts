import {formatUnits} from "ethers";
import {Request, Response, Router} from "express";
import {
    ClientErrors,
    findInstance,
    findRoute,
    INSTANCES,
    isValidPair,
    ROUTES,
    scheduleIdOf,
} from "../consts/Consts.js";
import ILogger from "../services/ILogger.js";
import {IScheduleStore, ScheduleConfig, ScheduleState} from "../services/ISchedule.js";
import ISwapExecutor from "../services/ISwapExecutor.js";

const MIN_INTERVAL_MS = 60_000;
const MAX_SLIPPAGE_BPS = 5_000;

export default function buildScheduleRouter(
    logger: ILogger,
    store: IScheduleStore,
    executor: ISwapExecutor,
): Router {
    const log = logger.clone("[ScheduleApi]");
    const router = Router();

    const wrap =
        (fn: (req: Request, res: Response) => Promise<unknown>) =>
        (req: Request, res: Response): void => {
            fn(req, res).catch((e) => {
                log.error(e);
                if (!res.headersSent) res.status(500).json({error: ClientErrors.INTERNAL});
            });
        };

    router.get("/catalog", (_req, res) => {
        res.json({instances: INSTANCES, routes: ROUTES});
    });

    router.get(
        "/schedules",
        wrap(async (_req, res) => {
            res.json({schedules: await store.list()});
        }),
    );

    router.get(
        "/schedules/:id/runs",
        wrap(async (req, res) => {
            res.json({runs: await store.runs(req.params.id)});
        }),
    );

    router.post(
        "/schedules",
        wrap(async (req, res) => {
            const parsed = parseScheduleBody(req.body);
            if ("error" in parsed) {
                res.status(400).json({error: parsed.error});
                return;
            }
            const {instanceId, routeId, chainId, intervalMs, amountPerRun, capTotal, slippageBps} = parsed;

            const id = scheduleIdOf(instanceId, routeId);
            const now = Date.now();
            const config: ScheduleConfig = {
                id,
                instanceId,
                routeId,
                chainId,
                intervalMs,
                amountPerRun,
                capTotal,
                slippageBps,
                createdAt: now,
                createdBy: String(res.locals.operator ?? "unknown"),
            };
            // A new schedule for the same pair replaces the old one outright, including its counters.
            const state: ScheduleState = {
                status: "active",
                swappedSoFar: "0",
                runCount: 0,
                lastRunAt: null,
                nextRunAt: now,
                consecutiveFailures: 0,
                lastError: null,
            };
            await store.put(config, state);
            log.info(`schedule ${id} created by ${config.createdBy}: ${amountPerRun} every ${intervalMs}ms, cap ${capTotal}`);
            res.json({config, state});
        }),
    );

    router.post(
        "/schedules/:id/stop",
        wrap(async (req, res) => {
            const entry = await store.get(req.params.id);
            if (!entry) {
                res.status(404).json({error: ClientErrors.NOT_FOUND});
                return;
            }
            await store.putState(entry.config.id, {...entry.state, status: "stopped", nextRunAt: 0});
            log.info(`schedule ${entry.config.id} stopped by ${res.locals.operator}`);
            res.json({ok: true});
        }),
    );

    // Counters are carried over untouched: a resumed schedule must keep counting towards the same cap
    // it was already partway through.
    router.post(
        "/schedules/:id/resume",
        wrap(async (req, res) => {
            const entry = await store.get(req.params.id);
            if (!entry) {
                res.status(404).json({error: ClientErrors.NOT_FOUND});
                return;
            }
            await store.putState(entry.config.id, {
                ...entry.state,
                status: "active",
                nextRunAt: Date.now(),
                consecutiveFailures: 0,
                lastError: null,
            });
            log.info(`schedule ${entry.config.id} resumed by ${res.locals.operator}`);
            res.json({ok: true});
        }),
    );

    router.delete(
        "/schedules/:id",
        wrap(async (req, res) => {
            await store.remove(req.params.id);
            log.info(`schedule ${req.params.id} deleted by ${res.locals.operator}`);
            res.json({ok: true});
        }),
    );

    router.get(
        "/reading/:instanceId/:routeId",
        wrap(async (req, res) => {
            const instance = findInstance(req.params.instanceId);
            const route = findRoute(req.params.routeId);
            if (!instance || !route || !isValidPair(instance, route)) {
                res.status(400).json({error: "Unknown contract or token."});
                return;
            }
            const reading = await executor.read(instance, route);
            res.json({
                fees: formatUnits(reading.fees, reading.decimalsIn),
                usdt: formatUnits(reading.usdt, reading.decimalsUsdt),
                usdtConfigured: reading.usdtConfigured,
                routerAllowed: reading.routerAllowed,
            });
        }),
    );

    router.post(
        "/swap/quote",
        wrap(async (req, res) => {
            const parsed = parseSwapBody(req.body);
            if ("error" in parsed) {
                res.status(400).json({error: parsed.error});
                return;
            }
            const {route, amount, slippageBps} = parsed;
            const q = await executor.quote(route, amount, slippageBps);
            res.json({
                routeLabel: q.routeLabel,
                amountIn: formatUnits(q.amountIn, q.decimalsIn),
                expectedOut: formatUnits(q.expectedOut, q.decimalsOut),
                minOut: formatUnits(q.minOut, q.decimalsOut),
                slippageBps: q.slippageBps,
            });
        }),
    );

    // Manual single swap, outside any schedule. Used to validate a route end-to-end before handing
    // it to the ticker.
    router.post(
        "/swap/run-once",
        wrap(async (req, res) => {
            const parsed = parseSwapBody(req.body);
            if ("error" in parsed) {
                res.status(400).json({error: parsed.error});
                return;
            }
            const {instance, route, amount, slippageBps} = parsed;

            const locked = await store.acquireChainLock(instance.chainId, 5 * 60_000);
            if (!locked) {
                res.status(409).json({error: "Another swap is running on this chain. Try again shortly."});
                return;
            }
            try {
                const result = await executor.execute(instance, route, amount, slippageBps);
                log.info(`run-once ${instance.id}/${route.id} by ${res.locals.operator}: ${result.txHash}`);
                res.json({
                    txHash: result.txHash,
                    amountIn: formatUnits(result.amountIn, result.decimalsIn),
                    expectedOut: formatUnits(result.expectedOut, result.decimalsOut),
                    minOut: formatUnits(result.minOut, result.decimalsOut),
                });
            } catch (e) {
                const reason = e instanceof Error ? e.message : String(e);
                log.error(`run-once ${instance.id}/${route.id} failed: ${reason}`);
                log.error(e);
                res.status(400).json({error: reason});
            } finally {
                await store.releaseChainLock(instance.chainId);
            }
        }),
    );

    return router;
}

function parseAmount(value: unknown, label: string): string | null {
    if (typeof value !== "string" && typeof value !== "number") return null;
    const text = String(value).trim();
    if (!/^\d+(\.\d+)?$/.test(text)) return null;
    if (Number(text) <= 0) return null;
    return text;
}

function parseScheduleBody(body: any):
    | {instanceId: string; routeId: string; chainId: number; intervalMs: number; amountPerRun: string; capTotal: string; slippageBps: number}
    | {error: string} {
    const swap = parseSwapBody(body);
    if ("error" in swap) return {error: swap.error};

    const intervalMs = Number(body?.intervalMs);
    if (!Number.isFinite(intervalMs) || intervalMs < MIN_INTERVAL_MS) {
        return {error: `intervalMs must be at least ${MIN_INTERVAL_MS}.`};
    }

    const capTotal = parseAmount(body?.capTotal, "capTotal");
    if (!capTotal) return {error: "capTotal must be a positive decimal number."};
    if (Number(capTotal) < Number(swap.amount)) {
        return {error: "capTotal must be at least one amountPerRun."};
    }

    return {
        instanceId: swap.instance.id,
        routeId: swap.route.id,
        chainId: swap.instance.chainId,
        intervalMs: Math.floor(intervalMs),
        amountPerRun: swap.amount,
        capTotal,
        slippageBps: swap.slippageBps,
    };
}

function parseSwapBody(body: any):
    | {instance: ReturnType<typeof findInstance> & object; route: ReturnType<typeof findRoute> & object; amount: string; slippageBps: number}
    | {error: string} {
    const instance = findInstance(String(body?.instanceId ?? ""));
    const route = findRoute(String(body?.routeId ?? ""));
    if (!instance || !route) return {error: "Unknown contract or token."};
    if (!isValidPair(instance, route)) return {error: "That token does not exist on this contract's chain."};

    const amount = parseAmount(body?.amountPerRun ?? body?.amount, "amount");
    if (!amount) return {error: "amount must be a positive decimal number."};

    const slippageBps = Number(body?.slippageBps ?? 100);
    if (!Number.isFinite(slippageBps) || slippageBps < 0 || slippageBps > MAX_SLIPPAGE_BPS) {
        return {error: `slippageBps must be between 0 and ${MAX_SLIPPAGE_BPS}.`};
    }

    return {instance, route, amount, slippageBps: Math.floor(slippageBps)};
}
