import ILogger from "./services/ILogger";
import IEnvConfig from "./services/IEnvConfig";
import IMessengerService from "./services/IMessengerService";
import RealtimeIndex from "./services-impl/RealtimeIndex";

export {ILogger, IEnvConfig, IMessengerService};

export {default as ILeaderBoardController} from "./services/ILeaderBoardController";

export interface IDependencies {
    logger: ILogger;
    envConfig: IEnvConfig;
    messenger: IMessengerService;
    realtimeIndex: RealtimeIndex;

    isProduction(): boolean;
}
