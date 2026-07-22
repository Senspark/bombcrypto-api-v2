import {IDependencies} from "./Services";

import EnvConfig from "./services-impl/EnvConfig";
import ConsoleLogger from "./services-impl/loggers/ConsoleLogger";
import RedisShareStore from "./services-impl/RedisShareStore";
import getPgPool from "./services-impl/PostgresClient";
import PostgresShareAnalyticsStore from "./services-impl/PostgresShareAnalyticsStore";
import NoopShareAnalyticsStore from "./services-impl/NoopShareAnalyticsStore";
import DiskImageStore from "./services-impl/DiskImageStore";
import SharpImageProcessor from "./services-impl/SharpImageProcessor";
import ApLoginAuthVerifier from "./services-impl/ApLoginAuthVerifier";
import SlackNotifier from "./services-impl/SlackNotifier";
import RedisRateLimiter from "./services-impl/RedisRateLimiter";
import TweetComposer from "./text/TweetComposer";
import ILogger from "./services/ILogger";
import IEnvConfig from "./services/IEnvConfig";
import IShareStore from "./services/IShareStore";
import IShareAnalyticsStore from "./services/IShareAnalyticsStore";
import IImageStore from "./services/IImageStore";
import IImageProcessor from "./services/IImageProcessor";
import IAuthVerifier from "./services/IAuthVerifier";
import ISlackNotifier from "./services/ISlackNotifier";
import IRateLimiter from "./services/IRateLimiter";

export default class Dependencies implements IDependencies {
    logger: ILogger;
    envConfig: IEnvConfig;
    shareStore: IShareStore;
    analyticsStore: IShareAnalyticsStore;
    imageStore: IImageStore;
    imageProcessor: IImageProcessor;
    authVerifier: IAuthVerifier;
    slackNotifier: ISlackNotifier;
    rateLimiter: IRateLimiter;
    tweetComposer: TweetComposer;

    constructor(options?: IOptions) {
        this.envConfig = options?.envConfig ?? new EnvConfig();
        this.logger = new ConsoleLogger('[D]');

        const redisUrl = this.envConfig.redisConnectionString;
        this.shareStore = new RedisShareStore(this.logger, redisUrl, this.envConfig.shareTtlSeconds);

        const databaseUrl = this.envConfig.databaseUrl;
        this.analyticsStore = databaseUrl
            ? new PostgresShareAnalyticsStore(getPgPool(databaseUrl), this.logger)
            : new NoopShareAnalyticsStore(this.logger);

        this.imageStore = new DiskImageStore(this.logger, this.envConfig.imageDir);
        this.imageProcessor = new SharpImageProcessor(this.logger, this.envConfig.imageMaxBytes);
        this.authVerifier = new ApLoginAuthVerifier(this.logger, this.envConfig.apLoginBaseUrl);
        this.slackNotifier = new SlackNotifier(this.logger, this.envConfig.slackWebhookUrl);
        this.rateLimiter = new RedisRateLimiter(this.logger, redisUrl, this.envConfig.rateLimitPerDay);
        this.tweetComposer = new TweetComposer();
    }

    isProduction(): boolean {
        return this.envConfig.isProduction;
    }
}

interface IOptions {
    envConfig?: IEnvConfig;
}
