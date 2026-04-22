const QUEUE_POOL_VISIBILITIES = 'queue-pool-visible';

const POOL_VISIBILITIES_DEFAULT = new Array(10).fill(true);

export class LocalStorage {
    private _queuePoolVisibilities: boolean[] | undefined = undefined;

    has(key: string): boolean {
        return localStorage.getItem(key) !== null;
    }

    get(key: string): string | null {
        return localStorage.getItem(key);
    }

    set(key: string, value: string): void {
        localStorage.setItem(key, value);
    }

    remove(key: string): void {
        localStorage.removeItem(key);
    }

    // ========================================

    getQueuePoolVisibilities(): boolean[] {
        if (!this._queuePoolVisibilities) {
            try {
                const poolVisibilities = localStorage.getItem(QUEUE_POOL_VISIBILITIES);
                if (poolVisibilities) {
                    this._queuePoolVisibilities = JSON.parse(poolVisibilities);
                    if (this._queuePoolVisibilities?.length !== 10) {
                        this._queuePoolVisibilities = POOL_VISIBILITIES_DEFAULT;
                    }
                } else {
                    this._queuePoolVisibilities = POOL_VISIBILITIES_DEFAULT;
                }
            } catch (e) {
                console.error(e);
                this._queuePoolVisibilities = POOL_VISIBILITIES_DEFAULT;
            }
        }
        return this._queuePoolVisibilities!!;
    }

    setQueuePoolVisibilities(poolVisibilities: boolean[]) {
        this._queuePoolVisibilities = poolVisibilities;
        localStorage.setItem(QUEUE_POOL_VISIBILITIES, JSON.stringify(poolVisibilities));
    }
}