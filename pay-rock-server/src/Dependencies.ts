import {IDependencies} from "./Services";
import IEnvConfig from "./services/IEnvConfig";
import ILogger from "./services/ILogger";
import IBlockchainApiClient from "./services/IBlockchainApiClient";
import IPreviewStore from "./services/IPreviewStore";
import IPayRockRepository from "./services/IPayRockRepository";

import EnvConfig from "./services-impl/EnvConfig";
import ConsoleLogger from "./services-impl/loggers/ConsoleLogger";
import getPgPool from "./services-impl/PostgresClient";
import getRedisClient from "./services-impl/Redis";
import BlockchainApiClient from "./services-impl/BlockchainApiClient";
import PreviewStore from "./services-impl/PreviewStore";
import PayRockRepository from "./services-impl/PayRockRepository";

export default class Dependencies implements IDependencies {
    envConfig: IEnvConfig;
    logger: ILogger;
    blockchainApi: IBlockchainApiClient;
    previewStore: IPreviewStore;
    repo: IPayRockRepository;

    constructor() {
        this.envConfig = new EnvConfig();
        this.logger = new ConsoleLogger('[D]');

        const pgPool = getPgPool(this.envConfig.databaseUrl);
        const redis = getRedisClient(this.envConfig.redisUrl);

        this.blockchainApi = new BlockchainApiClient(this.logger, this.envConfig.blockchainApi, !this.envConfig.isProduction);
        this.previewStore = new PreviewStore(redis, this.logger, this.envConfig.previewTtlSeconds);
        this.repo = new PayRockRepository(pgPool, this.logger);
    }

    isProduction(): boolean {
        return this.envConfig.isProduction;
    }
}
