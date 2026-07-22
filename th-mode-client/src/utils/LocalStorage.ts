const QUEUE_POOL_VISIBILITIES = 'queue-pool-visible';
const FAVORITE_WALLETS = 'favorite-wallets';

const POOL_VISIBILITIES_DEFAULT = new Array(10).fill(true);

type FavoritesListener = (favorites: string[]) => void;

export class LocalStorage {
    private _queuePoolVisibilities: boolean[] | undefined = undefined;
    private _favoriteWallets: string[] | undefined = undefined;
    private _favoritesListeners: Set<FavoritesListener> = new Set();

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

    // ========================================

    getFavoriteWallets(): string[] {
        if (!this._favoriteWallets) {
            try {
                const raw = localStorage.getItem(FAVORITE_WALLETS);
                const parsed = raw ? JSON.parse(raw) : [];
                this._favoriteWallets = Array.isArray(parsed)
                    ? Array.from(new Set(parsed.filter((w): w is string => typeof w === 'string')))
                    : [];
            } catch (e) {
                console.error(e);
                this._favoriteWallets = [];
            }
        }
        return this._favoriteWallets!;
    }

    isFavorite(wallet: string): boolean {
        const w = wallet.toLowerCase();
        return this.getFavoriteWallets().includes(w);
    }

    addFavorite(wallet: string): void {
        const w = wallet.trim().toLowerCase();
        if (!w) return;
        const list = this.getFavoriteWallets();
        if (list.includes(w)) return;
        this.#persistFavorites([...list, w]);
    }

    removeFavorite(wallet: string): void {
        const w = wallet.toLowerCase();
        const list = this.getFavoriteWallets();
        if (!list.includes(w)) return;
        this.#persistFavorites(list.filter((x) => x !== w));
    }

    toggleFavorite(wallet: string): boolean {
        if (this.isFavorite(wallet)) {
            this.removeFavorite(wallet);
            return false;
        }
        this.addFavorite(wallet);
        return true;
    }

    subscribeFavorites(listener: FavoritesListener): () => void {
        this._favoritesListeners.add(listener);
        return () => this._favoritesListeners.delete(listener);
    }

    #persistFavorites(next: string[]): void {
        this._favoriteWallets = next;
        localStorage.setItem(FAVORITE_WALLETS, JSON.stringify(next));
        this._favoritesListeners.forEach((cb) => {
            try { cb(next); } catch (e) { console.error(e); }
        });
    }
}
