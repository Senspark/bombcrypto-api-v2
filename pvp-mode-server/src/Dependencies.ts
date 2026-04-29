import { IDependencies } from "./Services";
import EnvConfig from "./services-impl/EnvConfig";
import IEnvConfig from "./services/IEnvConfig";
import ILogger from "./services/ILogger";
import ConsoleLogger from "./services-impl/ConsoleLogger";
import IDatabaseService from "./services/IDatabaseService";
import PostgresDatabaseService from "./services-impl/PostgresDatabaseService";

export default class Dependencies implements IDependencies {
    envConfig: IEnvConfig;
    logger: ILogger;
    database: IDatabaseService;

    constructor() {
        this.envConfig = new EnvConfig();
        this.logger = new ConsoleLogger("[PVP-API]");
        this.database = new PostgresDatabaseService(this.envConfig.postgresConnectionString, this.logger);
    }
}
