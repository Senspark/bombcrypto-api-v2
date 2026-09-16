import IEnvConfig from "./services/IEnvConfig.js";
import ILogger from "./services/ILogger.js";
import EnvConfig from "./services-impl/EnvConfig.js";
import ConsoleLogger from "./services-impl/loggers/ConsoleLogger.js";

export default class Dependencies {
    envConfig: IEnvConfig;
    logger: ILogger;

    constructor() {
        this.envConfig = new EnvConfig();
        this.logger = new ConsoleLogger("[D]");
    }
}
