import express from "express";
import cors from "cors";
import Routes from "./Routes";
import Dependencies from "./Dependencies";
import PayRockHandler from "./routers/PayRockHandler";

const dependencies = new Dependencies();
const logger = dependencies.logger;
const envConfig = dependencies.envConfig;

const payRockHandler = new PayRockHandler(
    logger,
    dependencies.blockchainApi,
    dependencies.previewStore,
    dependencies.repo,
    envConfig.previewTtlSeconds,
);

try {
    const app = express();
    app.use(cors());

    Routes.setupStandardModules(app, logger);

    const mainRouter = express.Router();
    app.use('/pay-rock', mainRouter);

    Routes.setupBasicRoutes(app);
    Routes.setupPayRockRoutes(mainRouter, payRockHandler);

    app.listen(envConfig.port, () => {
        logger.info(`pay-rock-server started at http://localhost:${envConfig.port}`);
    });
} catch (e) {
    logger.error('Error starting server:');
    logger.error(e);
}
