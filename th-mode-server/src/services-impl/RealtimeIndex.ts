import {IHeroInfo} from "../consts/Consts";

/**
 * In-memory index: uid → list of heroes participating in the current race.
 *
 * Owned by the stream consumer (LeaderBoardController); read by WatchHandler.
 * Cleared whenever a new race begins.
 */
export default class RealtimeIndex {
    /** uid → uniqueKey → IHeroInfo. Inner map handles replace-on-update. */
    readonly #byUid = new Map<number, Map<string, IHeroInfo>>();

    update(hero: IHeroInfo): void {
        let bucket = this.#byUid.get(hero.uid);
        if (!bucket) {
            bucket = new Map();
            this.#byUid.set(hero.uid, bucket);
        }
        bucket.set(hero.uniqueKey, hero);
    }

    getByUid(uid: number): IHeroInfo[] {
        const bucket = this.#byUid.get(uid);
        return bucket ? Array.from(bucket.values()) : [];
    }

    clearAll(): void {
        this.#byUid.clear();
    }
}
