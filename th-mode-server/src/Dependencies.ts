import {IDependencies} from "./Services";

import EnvConfig from "./services-impl/EnvConfig";
import IEnvConfig from "./services/IEnvConfig";
import ILogger from "./services/ILogger";
import IMessengerService from "./services/IMessengerService";
import MessengerService from "./services-impl/MessengerService";
import FakeMessengerService from "./services-impl/FakeMessengerService";
import ConsoleLogger from "./services-impl/loggers/ConsoleLogger";
import RealtimeIndex from "./services-impl/RealtimeIndex";

export default class Dependencies implements IDependencies {
    envConfig: IEnvConfig;
    logger: ILogger;
    messenger: IMessengerService;
    realtimeIndex: RealtimeIndex;

    constructor(options?: IOptions) {
        this.envConfig = options?.envConfig ?? new EnvConfig();

        this.logger = new ConsoleLogger('[D]');
        this.messenger = this.envConfig.useMockData
            ? new FakeMessengerService(this.logger, this.envConfig)
            : new MessengerService(this.logger, this.envConfig);
        this.realtimeIndex = new RealtimeIndex();
    }

    isProduction(): boolean {
        return this.envConfig.isProduction;
    }
}

interface IOptions {
    envConfig?: IEnvConfig
}