import ILogger from "./services/ILogger";
import IEnvConfig from "./services/IEnvConfig";
import IShareStore from "./services/IShareStore";
import IShareAnalyticsStore from "./services/IShareAnalyticsStore";
import IImageStore from "./services/IImageStore";
import IImageProcessor from "./services/IImageProcessor";
import IAuthVerifier from "./services/IAuthVerifier";
import ISlackNotifier from "./services/ISlackNotifier";
import IRateLimiter from "./services/IRateLimiter";
import TweetComposer from "./text/TweetComposer";

export {
    ILogger,
    IEnvConfig,
    IShareStore,
    IShareAnalyticsStore,
    IImageStore,
    IImageProcessor,
    IAuthVerifier,
    ISlackNotifier,
    IRateLimiter,
};

export interface IDependencies {
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
}
