import IEnvConfig from "./services/IEnvConfig";
import ILogger from "./services/ILogger";
import IDatabaseService from "./services/IDatabaseService";

export interface IDependencies {
    envConfig: IEnvConfig;
    logger: ILogger;
    database: IDatabaseService;
}
