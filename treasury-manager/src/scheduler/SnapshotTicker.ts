import {NATIVE_NETWORKS} from "../consts/Consts.js";
import ILogger from "../services/ILogger.js";
import NativeStatsService from "../services-impl/NativeStatsService.js";

// Only the day boundary matters, so this beats far slower than the swap ticker. Every beat but the
// first one after midnight costs a single Redis lookup per network.
const SNAPSHOT_INTERVAL_MS = 5 * 60_000;

export default class SnapshotTicker {
    private log: ILogger;
    private timer: NodeJS.Timeout | null = null;
    private ticking = false;

    constructor(logger: ILogger, private stats: NativeStatsService) {
        this.log = logger.clone("[Snapshot]");
    }

    start(): void {
        // Run immediately as well, so a fresh deploy has a baseline to subtract from tomorrow rather
        // than waiting a day for the first closing.
        void this.tick();
        this.timer = setInterval(() => void this.tick(), SNAPSHOT_INTERVAL_MS);
        this.log.info(`daily closing check every ${SNAPSHOT_INTERVAL_MS / 60_000}m`);
    }

    stop(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    private async tick(): Promise<void> {
        if (this.ticking) return;
        this.ticking = true;
        try {
            for (const network of NATIVE_NETWORKS) {
                try {
                    await this.stats.captureClosing(network, new Date());
                } catch (e) {
                    // One network failing must not skip the other, and a silent skip would show up
                    // much later as a missing day in the chart.
                    this.log.error(`closing failed for ${network}:`);
                    this.log.error(e);
                }
            }
        } finally {
            this.ticking = false;
        }
    }
}
