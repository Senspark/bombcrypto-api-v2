import ILogger from "../services/ILogger";
import IBlockchainApiClient, {IQueryRockBurnTxResponse} from "../services/IBlockchainApiClient";
import {Network} from "../consts/Consts";

const QUERY_ROCK_BURN_TX = '/query_rock_burn_tx';

export default class BlockchainApiClient implements IBlockchainApiClient {
    readonly #logger: ILogger;
    readonly #host: string;
    readonly #debug: boolean;

    constructor(logger: ILogger, host: string, debug: boolean = true) {
        this.#logger = logger.clone('[BlockchainApi]');
        this.#host = host;
        this.#debug = debug;
    }

    /**
     * Returns null when the upstream confirms the tx is not a burn-rock tx.
     * Throws {@link BlockchainApiError} on transport failure (network, HTTP 5xx, parse error).
     */
    async queryRockBurnTx(tx: string, network: Network): Promise<IQueryRockBurnTxResponse | null> {
        const url = `${this.#host}${QUERY_ROCK_BURN_TX}?tx=${encodeURIComponent(tx)}&network=${encodeURIComponent(network)}`;
        let res: Response;
        try {
            res = await fetch(url);
        } catch (e) {
            throw new BlockchainApiError(`fetch failed ${tx}/${network}: ${(e as Error).message}`);
        }
        if (!res.ok) {
            throw new BlockchainApiError(`HTTP ${res.status} for ${tx}/${network}`);
        }

        let body: any;
        try {
            body = await res.json();
        } catch (e) {
            throw new BlockchainApiError(`json parse failed ${tx}/${network}: ${(e as Error).message}`);
        }

        if (this.#debug) {
            this.#logger.info(`raw ${tx}/${network}: ${JSON.stringify(body).slice(0, 600)}`);
        }

        const payload = unwrap(body);
        if (!payload || typeof payload !== 'object') {
            this.#logger.info(`unwrap returned non-object for ${tx}/${network}`);
            return null;
        }
        const heroIds = coerceHeroIds(payload.hero_ids ?? payload.heroIds);
        const wallet = typeof payload.wallet_address === 'string' ? payload.wallet_address
            : typeof payload.walletAddress === 'string' ? payload.walletAddress
                : null;
        if (!heroIds || !wallet) {
            this.#logger.info(`shape mismatch for ${tx}/${network}: keys=${Object.keys(payload).join(',')}`);
            return null;
        }
        return {
            tx: String(payload.tx ?? tx),
            wallet_address: wallet,
            hero_ids: heroIds,
        };
    }
}

export class BlockchainApiError extends Error {
}

function unwrap(body: any): any {
    // Upstream may wrap as {success, error, message} (legacy) or {code, message} (ap-blockchain).
    // In both cases the inner payload lives under `message`. Bare (unwrapped) payloads are passed through.
    if (body == null) return null;
    if (typeof body !== 'object') return body;
    if ('message' in body) {
        const m = body.message;
        if (typeof m === 'string') {
            try { return JSON.parse(m); } catch { return null; }
        }
        return m;
    }
    return body;
}

function coerceHeroIds(v: any): number[] | null {
    if (Array.isArray(v)) {
        const nums = v.map((x) => Number(x));
        return nums.every((n) => Number.isFinite(n)) ? nums : null;
    }
    if (typeof v === 'string') {
        try {
            const parsed = JSON.parse(v);
            return coerceHeroIds(parsed);
        } catch {
            return null;
        }
    }
    return null;
}

