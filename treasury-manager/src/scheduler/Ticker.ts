import {formatUnits, parseUnits} from "ethers";
import {findInstance, findRoute} from "../consts/Consts.js";
import IEnvConfig from "../services/IEnvConfig.js";
import ILogger from "../services/ILogger.js";
import {IScheduleStore, ScheduleConfig, ScheduleState} from "../services/ISchedule.js";
import ISwapExecutor from "../services/ISwapExecutor.js";

const LOCK_TTL_MS = 5 * 60_000;

export default class Ticker {
    private log: ILogger;
    private timer: NodeJS.Timeout | null = null;
    private ticking = false;

    constructor(
        logger: ILogger,
        private store: IScheduleStore,
        private executor: ISwapExecutor,
        private env: IEnvConfig,
    ) {
        this.log = logger.clone("[Tick]");
    }

    start(): void {
        this.timer = setInterval(() => {
            void this.tick().catch((e) => this.log.error(e));
        }, this.env.tickIntervalMs);
        this.log.info(`scheduler started, interval ${this.env.tickIntervalMs}ms`);
    }

    stop(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    // Overlapping ticks would let a slow swap be started twice, so a tick that is still running
    // simply skips the next beat.
    private async tick(): Promise<void> {
        if (this.ticking) return;
        this.ticking = true;
        try {
            const now = Date.now();
            const entries = await this.store.list();
            const due = entries.filter((e) => e.state.status === "active" && now >= e.state.nextRunAt);
            for (const {config, state} of due) {
                await this.runOne(config, state);
            }
        } finally {
            this.ticking = false;
        }
    }

    private async runOne(config: ScheduleConfig, state: ScheduleState): Promise<void> {
        const instance = findInstance(config.instanceId);
        const route = findRoute(config.routeId);
        if (!instance || !route) {
            this.log.error(`schedule ${config.id} references unknown instance/route — marking error`);
            await this.store.putState(config.id, {...state, status: "error", lastError: "Unknown contract or token."});
            return;
        }

        // Cap is checked in raw units so a decimal string never rounds its way past the ceiling.
        const decimals = 18;
        const swapped = parseUnits(state.swappedSoFar || "0", decimals);
        const perRun = parseUnits(config.amountPerRun, decimals);
        const cap = parseUnits(config.capTotal, decimals);
        if (swapped + perRun > cap) {
            this.log.info(
                `schedule ${config.id} completed: ${state.swappedSoFar} + ${config.amountPerRun} would exceed cap ${config.capTotal}`,
            );
            await this.store.putState(config.id, {...state, status: "completed", nextRunAt: 0});
            return;
        }

        const locked = await this.store.acquireChainLock(config.chainId, LOCK_TTL_MS);
        if (!locked) {
            this.log.info(`schedule ${config.id} deferred: chain ${config.chainId} is busy`);
            return;
        }

        const at = Date.now();
        try {
            const result = await this.executor.execute(instance, route, config.amountPerRun, config.slippageBps);
            const nextSwapped = formatUnits(swapped + perRun, decimals);
            await this.store.putState(config.id, {
                status: "active",
                swappedSoFar: nextSwapped,
                runCount: state.runCount + 1,
                lastRunAt: at,
                nextRunAt: at + config.intervalMs,
                lastError: null,
            });
            await this.store.pushRun(config.id, {
                at,
                ok: true,
                txHash: result.txHash,
                amountIn: formatUnits(result.amountIn, result.decimalsIn),
                expectedOut: formatUnits(result.expectedOut, result.decimalsOut),
                minOut: formatUnits(result.minOut, result.decimalsOut),
                error: null,
            });
            this.log.info(`schedule ${config.id} run ${state.runCount + 1} ok, swapped total ${nextSwapped}`);
        } catch (e) {
            // A failing schedule stops rather than burning gas on the same revert every interval.
            const reason = e instanceof Error ? e.message : String(e);
            this.log.error(`schedule ${config.id} run failed: ${reason}`);
            this.log.error(e);
            await this.store.putState(config.id, {
                ...state,
                status: "error",
                lastRunAt: at,
                lastError: reason,
            });
            await this.store.pushRun(config.id, {
                at,
                ok: false,
                txHash: null,
                amountIn: null,
                expectedOut: null,
                minOut: null,
                error: reason,
            });
        } finally {
            await this.store.releaseChainLock(config.chainId);
        }
    }
}
