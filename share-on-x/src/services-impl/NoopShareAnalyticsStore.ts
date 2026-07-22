import ILogger from "../services/ILogger";
import IShareAnalyticsStore from "../services/IShareAnalyticsStore";
import {ShareRecord} from "../services/IShareStore";

// Used when DATABASE_URL is not configured: the service still boots and serves
// shares, but analytics persistence is silently off.
export default class NoopShareAnalyticsStore implements IShareAnalyticsStore {
    constructor(logger: ILogger) {
        logger.clone('[SHARE-ANALYTICS]').info('DATABASE_URL not set — analytics persistence disabled');
    }

    async record(_id: string, _record: ShareRecord): Promise<void> {
        // no-op
    }
}
