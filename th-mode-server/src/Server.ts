import express from "express";
import cors from "cors";
import Routes from "./Routes";
import LeaderBoardHandler from "./routers/LeaderBoardHandler";
import WatchHandler from "./routers/WatchHandler";
import Dependencies from "./Dependencies";
import getPgPool from "./services-impl/PostgresClient";
import WalletResolver from "./services-impl/WalletResolver";
import WatchRepository from "./services-impl/WatchRepository";
import RewardPoolRepository from "./services-impl/RewardPoolRepository";

const dependencies = new Dependencies();
export const logger = dependencies.logger;
export const envConfig = dependencies.envConfig;

const pgPool = getPgPool(envConfig.databaseUrl);
const rewardPoolRepository = new RewardPoolRepository(pgPool, logger);
const leaderboardHandler = new LeaderBoardHandler(dependencies, rewardPoolRepository);

const walletResolver = new WalletResolver(pgPool, logger);
const watchRepository = new WatchRepository(pgPool, logger);
const watchHandler = new WatchHandler(
    logger,
    walletResolver,
    watchRepository,
    dependencies.realtimeIndex,
    leaderboardHandler,
);


try {
    const app = express();

    Routes.setupStandardModules(app, logger, envConfig);

    const mainRouter = express.Router();

    app.use(`/th`, mainRouter);

    Routes.setupBasicRoutes(app);
    Routes.setupLeaderBoardRoutes(mainRouter, leaderboardHandler);
    Routes.setupWatchRoutes(mainRouter, watchHandler);

    app.listen(envConfig.port, () => {
        logger.info(`Server started at http://localhost:${envConfig.port}`);
    });
} catch (e) {
    logger.error(`Error starting server:`);
    logger.error(e);
}