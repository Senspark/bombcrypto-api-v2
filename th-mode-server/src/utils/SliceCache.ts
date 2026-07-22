/**
 * Generic singleflight + TTL cache.
 *
 * Invariants:
 * - N concurrent `.get(sameKey)` calls within a TTL window result in at most 1 fetcher invocation.
 * - After fetcher resolves, subsequent calls within TTL return cached value.
 * - Failures are not cached: the in-flight promise is cleared on both fulfilment and rejection.
 */
export type TtlResolver<V> = number | ((value: V) => number);

export default class SliceCache<K, V> {
    private readonly _cache = new Map<K, { data: V; expiresAt: number }>();
    private readonly _inflight = new Map<K, Promise<V>>();

    constructor(
        private readonly _ttl: TtlResolver<V>,
        private readonly _fetcher: (key: K) => Promise<V>,
    ) {}

    async get(key: K): Promise<V> {
        const cached = this._cache.get(key);
        if (cached && Date.now() < cached.expiresAt) {
            return cached.data;
        }

        const inflight = this._inflight.get(key);
        if (inflight) return inflight;

        const promise = this._fetcher(key)
            .then((data) => {
                const ttlMs = typeof this._ttl === 'function' ? this._ttl(data) : this._ttl;
                this._cache.set(key, {data, expiresAt: Date.now() + ttlMs});
                return data;
            })
            .finally(() => this._inflight.delete(key));
        this._inflight.set(key, promise);
        return promise;
    }

    invalidate(key: K): void {
        this._cache.delete(key);
    }

    clear(): void {
        this._cache.clear();
    }
}
