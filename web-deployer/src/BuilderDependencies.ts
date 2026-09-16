import {KeyObject} from "node:crypto";
import IBuilderConfig from "./services/IBuilderConfig";
import ILogger from "./services/ILogger";
import ISiteRegistry from "./services/ISiteRegistry";
import IDeployStateStore from "./services/IDeployStateStore";

import BuilderConfig from "./services-impl/BuilderConfig";
import ConsoleLogger from "./services-impl/loggers/ConsoleLogger";
import SiteRegistry from "./services-impl/SiteRegistry";
import FileDeployStateStore from "./services-impl/FileDeployStateStore";
import DeployRunner from "./services-impl/DeployRunner";
import {loadPublicKey} from "./utils/TriggerSignature";

export default class BuilderDependencies {
    readonly config: IBuilderConfig;
    readonly logger: ILogger;
    readonly registry: ISiteRegistry;
    readonly stateStore: IDeployStateStore;
    readonly runner: DeployRunner;
    readonly triggerPublicKey: KeyObject;

    constructor() {
        this.config = new BuilderConfig();
        this.logger = new ConsoleLogger('[B]');

        this.registry = new SiteRegistry(this.config.sitesFile, this.logger);
        this.stateStore = new FileDeployStateStore(this.config.stateFile, this.config.historyLimit, this.logger);
        this.triggerPublicKey = loadPublicKey(this.config.triggerPublicKey);
        this.runner = new DeployRunner(
            this.logger,
            this.stateStore,
            this.registry,
            this.config.reposDir,
            this.config.logsDir,
            this.config.backupDir,
            this.config.backupKeep,
            this.config.gitTimeoutMs,
            this.config.buildTimeoutMs,
            this.config.publishTimeoutMs,
            this.config.logTailLines,
        );
    }
}
