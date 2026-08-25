import {BlockList, isIPv4, isIPv6} from "node:net";
import IHookIpFilter, {HookIpMode} from "../services/IHookIpFilter";
import ILogger from "../services/ILogger";

const FETCH_TIMEOUT_MS = 10 * 1000;

export default class GithubIpFilter implements IHookIpFilter {
    readonly #logger: ILogger;
    readonly #mode: HookIpMode;
    readonly #metaUrl: string;
    readonly #refreshMs: number;

    #ranges: BlockList | null = null;

    constructor(logger: ILogger, mode: HookIpMode, metaUrl: string, refreshMs: number) {
        this.#logger = logger.clone('[HookIP]');
        this.#mode = mode;
        this.#metaUrl = metaUrl;
        this.#refreshMs = refreshMs;
    }

    start(): void {
        if (this.#mode === 'off') {
            this.#logger.info('disabled');
            return;
        }

        const tick = async () => {
            await this.#refresh();
            setTimeout(tick, this.#refreshMs).unref();
        };
        void tick();
    }

    allow(ip: string | undefined): boolean {
        if (this.#mode === 'off') return true;

        const address = normalise(ip);
        const matched = address !== undefined && this.#matches(address);
        if (matched) return true;

        // GitHub publishes these ranges and does change them. Enforcing a list
        // that never loaded, or one that has gone stale, would stop deploys
        // silently - and silence here looks exactly like nobody pushing.
        if (this.#ranges === null) {
            this.#logger.error(`no ranges loaded yet, letting ${address ?? 'unknown ip'} through`);
            return true;
        }

        this.#logger.error(`${address ?? 'unknown ip'} is not a published GitHub hook address`
            + (this.#mode === 'enforce' ? '' : ' (log mode, allowed)'));
        return this.#mode !== 'enforce';
    }

    #matches(address: string): boolean {
        if (this.#ranges === null) return false;
        if (isIPv4(address)) return this.#ranges.check(address, 'ipv4');
        if (isIPv6(address)) return this.#ranges.check(address, 'ipv6');
        return false;
    }

    async #refresh(): Promise<void> {
        try {
            const res = await fetch(this.#metaUrl, {signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)});
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const hooks = (await res.json() as {hooks?: unknown}).hooks;
            if (!Array.isArray(hooks) || hooks.length === 0) {
                throw new Error('meta response carries no hooks list');
            }

            const ranges = new BlockList();
            let loaded = 0;
            for (const entry of hooks) {
                if (typeof entry !== 'string') continue;
                const [address, prefix] = entry.split('/');
                if (isIPv4(address)) {
                    ranges.addSubnet(address, prefix === undefined ? 32 : Number(prefix), 'ipv4');
                    loaded++;
                } else if (isIPv6(address)) {
                    ranges.addSubnet(address, prefix === undefined ? 128 : Number(prefix), 'ipv6');
                    loaded++;
                }
            }
            if (loaded === 0) throw new Error('no usable ranges in meta response');

            this.#ranges = ranges;
            this.#logger.info(`loaded ${loaded} GitHub hook ranges (mode=${this.#mode})`);
        } catch (e) {
            // Keep the previous list: a stale allowlist beats no allowlist, and
            // beats refusing every webhook because GitHub's meta endpoint blinked.
            this.#logger.error(`cannot refresh ranges, keeping the previous list: ${(e as Error).message}`);
        }
    }
}

// Cloudflare writes the client address into CF-Connecting-IP, and the origin
// only accepts connections from Cloudflare, so that header is the real source.
// Node still reports v4 peers as ::ffff:a.b.c.d in some paths.
function normalise(ip: string | undefined): string | undefined {
    if (!ip) return undefined;
    const trimmed = ip.trim();
    const unmapped = trimmed.startsWith('::ffff:') ? trimmed.slice(7) : trimmed;
    return isIPv4(unmapped) || isIPv6(unmapped) ? unmapped : undefined;
}
