import IReceiverConfig from "./services/IReceiverConfig";
import ILogger from "./services/ILogger";
import ISiteRegistry from "./services/ISiteRegistry";
import ISecretStore from "./services/ISecretStore";
import IBuildClient from "./services/IBuildClient";
import INotifier from "./services/INotifier";
import IAuthService from "./services/IAuthService";

import ReceiverConfig from "./services-impl/ReceiverConfig";
import ConsoleLogger from "./services-impl/loggers/ConsoleLogger";
import SiteRegistry from "./services-impl/SiteRegistry";
import EnvSecretStore from "./services-impl/EnvSecretStore";
import HttpBuildClient from "./services-impl/HttpBuildClient";
import SlackNotifier from "./services-impl/SlackNotifier";
import BuildPoller from "./services-impl/BuildPoller";
import GithubIpFilter from "./services-impl/GithubIpFilter";
import MemoryAuthService from "./services-impl/MemoryAuthService";
import {loadPrivateKey} from "./utils/TriggerSignature";

export default class ReceiverDependencies {
    readonly config: IReceiverConfig;
    readonly logger: ILogger;
    readonly registry: ISiteRegistry;
    readonly secrets: ISecretStore;
    readonly builder: IBuildClient;
    readonly notifier: INotifier;
    readonly poller: BuildPoller;
    readonly hookIpFilter: GithubIpFilter;
    readonly auth: IAuthService;

    constructor() {
        this.config = new ReceiverConfig();
        this.logger = new ConsoleLogger('[R]');

        this.registry = new SiteRegistry(this.config.sitesFile, this.logger);
        this.secrets = new EnvSecretStore(this.registry.list().map(site => site.name));
        this.builder = new HttpBuildClient(
            this.logger,
            this.config.builderUrl,
            this.config.builderTimeoutMs,
            loadPrivateKey(this.config.triggerPrivateKey),
        );
        this.notifier = new SlackNotifier(this.logger, this.config.slackWebhookUrl);
        this.poller = new BuildPoller(this.logger, this.builder, this.notifier, this.config.pollIntervalMs, this.config.dashboardUrl);
        this.auth = new MemoryAuthService(this.logger, this.config);
        this.hookIpFilter = new GithubIpFilter(
            this.logger,
            this.config.hookIpMode,
            this.config.githubMetaUrl,
            this.config.githubMetaRefreshMs,
        );
    }
}
