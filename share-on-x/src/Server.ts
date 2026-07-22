import express from "express";
import Routes from "./Routes";
import Dependencies from "./Dependencies";
import CreateShareHandler from "./routers/CreateShareHandler";
import RenderShareHandler from "./routers/RenderShareHandler";
import AdminDeleteHandler from "./routers/AdminDeleteHandler";

const dependencies = new Dependencies();
export const logger = dependencies.logger;
export const envConfig = dependencies.envConfig;

try {
    const app = express();

    Routes.setupStandardModules(app, logger, envConfig);

    const createHandler = new CreateShareHandler(dependencies);
    const renderHandler = new RenderShareHandler(dependencies);
    const adminHandler = new AdminDeleteHandler(dependencies);

    Routes.setupRoutes(app, createHandler, renderHandler, adminHandler);

    app.listen(envConfig.port, () => {
        logger.info(`Server started at http://localhost:${envConfig.port}`);
    });
} catch (e) {
    logger.error(`Error starting server:`);
    logger.error(e);
}
