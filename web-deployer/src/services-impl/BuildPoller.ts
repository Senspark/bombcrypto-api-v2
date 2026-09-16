import IBuildClient from "../services/IBuildClient";
import IBuildSnapshotSource, {IBuildSnapshot} from "../services/IBuildSnapshot";
import INotifier from "../services/INotifier";
import ILogger from "../services/ILogger";
import {buildMessage, builderBackMessage, builderLostMessage} from "../utils/SlackMessage";

export default class BuildPoller implements IBuildSnapshotSource {
    readonly #logger: ILogger;
    readonly #client: IBuildClient;
    readonly #notifier: INotifier;
    readonly #intervalMs: number;
    readonly #dashboardUrl: string;

    readonly #notified = new Set<string>();
    #snapshot: IBuildSnapshot | null = null;
    #seeded = false;
    #reachable = true;

    constructor(logger: ILogger, client: IBuildClient, notifier: INotifier, intervalMs: number, dashboardUrl: string) {
        this.#logger = logger.clone('[Poll]');
        this.#client = client;
        this.#notifier = notifier;
        this.#intervalMs = intervalMs;
        this.#dashboardUrl = dashboardUrl;
    }

    // The builder owns the state, so the receiver has to ask. It polls rather
    // than being pushed to, so no endpoint exists here for a build to call and
    // put words in this channel.
    start(): void {
        const tick = async () => {
            try {
                await this.#poll();
            } finally {
                setTimeout(tick, this.#intervalMs).unref();
            }
        };
        void tick();
    }

    current(): IBuildSnapshot | null {
        return this.#snapshot;
    }

    reachable(): boolean {
        return this.#reachable && this.#snapshot !== null;
    }

    async #poll(): Promise<void> {
        let snapshot: IBuildSnapshot;
        try {
            snapshot = await this.#client.snapshot();
        } catch (e) {
            await this.#markUnreachable((e as Error).message);
            return;
        }

        if (!this.#reachable) {
            this.#reachable = true;
            this.#logger.info('builder reachable again');
            await this.#notifier.send(builderBackMessage());
        }
        this.#snapshot = snapshot;

        // On the first poll every existing build looks new. Record them without
        // notifying, so a receiver restart does not replay old builds to Slack.
        const announce = this.#seeded;
        this.#seeded = true;

        const live = new Set<string>();
        for (const site of snapshot.sites) {
            for (const state of [...site.history].reverse()) {
                const key = `${state.site}:${state.startedAt}:${state.status}`;
                live.add(key);
                if (this.#notified.has(key)) continue;
                this.#notified.add(key);

                if (!announce) continue;
                const message = buildMessage(site, state, this.#dashboardUrl);
                if (message) await this.#notifier.send(message);
            }
        }

        // Runs that aged out of the builder's history can never come back, so
        // their keys would otherwise pile up for the lifetime of the process.
        for (const key of this.#notified) {
            if (!live.has(key)) this.#notified.delete(key);
        }
    }

    async #markUnreachable(reason: string): Promise<void> {
        this.#logger.error(`cannot reach builder: ${reason}`);
        if (!this.#reachable) return;

        // Silence is indistinguishable from "nobody pushed", so it has to be said
        // out loud once - but only on the transition, not every poll.
        this.#reachable = false;
        await this.#notifier.send(builderLostMessage(reason));
    }
}
