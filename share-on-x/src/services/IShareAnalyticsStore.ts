import {ShareRecord} from "./IShareStore";

export default interface IShareAnalyticsStore {
    /**
     * Append-only durable write of a share event, for later analytics.
     * Separate from IShareStore (which is the TTL-bounded serving store).
     * Implementations may throw; the caller must isolate failures so a broken
     * analytics write never fails the user's share.
     */
    record(id: string, record: ShareRecord): Promise<void>;
}
