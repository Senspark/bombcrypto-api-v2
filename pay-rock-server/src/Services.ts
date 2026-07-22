import ILogger from "./services/ILogger";
import IEnvConfig from "./services/IEnvConfig";
import IBlockchainApiClient from "./services/IBlockchainApiClient";
import IPreviewStore from "./services/IPreviewStore";
import IPayRockRepository from "./services/IPayRockRepository";

export {ILogger, IEnvConfig, IBlockchainApiClient, IPreviewStore, IPayRockRepository};

export interface IDependencies {
    logger: ILogger;
    envConfig: IEnvConfig;
    blockchainApi: IBlockchainApiClient;
    previewStore: IPreviewStore;
    repo: IPayRockRepository;

    isProduction(): boolean;
}
