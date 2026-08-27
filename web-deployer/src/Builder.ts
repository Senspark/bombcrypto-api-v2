import express from "express";
import Routes from "./Routes";
import BuilderDependencies from "./BuilderDependencies";
import TriggerHandler from "./routers/TriggerHandler";
import BuildsHandler from "./routers/BuildsHandler";
import PreviewHandler from "./routers/PreviewHandler";
import RollbackHandler from "./routers/RollbackHandler";

const dependencies = new BuilderDependencies();
const logger = dependencies.logger;

const triggerHandler = new TriggerHandler(
    logger,
    dependencies.registry,
    dependencies.runner,
    dependencies.triggerPublicKey,
    dependencies.config.triggerMaxAgeMs,
);
const previewHandler = new PreviewHandler(
    logger,
    dependencies.registry,
    dependencies.runner,
    dependencies.triggerPublicKey,
    dependencies.config.triggerMaxAgeMs,
);
const rollbackHandler = new RollbackHandler(
    logger,
    dependencies.registry,
    dependencies.runner,
    dependencies.triggerPublicKey,
    dependencies.config.triggerMaxAgeMs,
);
const buildsHandler = new BuildsHandler(logger, dependencies.registry, dependencies.stateStore, dependencies.runner);

try {
    const app = express();

    // No cors and no static dashboard here: nothing outside the receiver's
    // network is meant to talk to this process.
    Routes.setupStandardModules(app, logger);
    Routes.setupBasicRoutes(app);

    const apiRouter = express.Router();
    app.use('/api', apiRouter);
    Routes.setupBuilderRoutes(apiRouter, triggerHandler, previewHandler, rollbackHandler, buildsHandler);

    void dependencies.runner.reconcileInterrupted();

    app.listen(dependencies.config.port, () => {
        logger.info(`builder started at http://localhost:${dependencies.config.port}`);
    });
} catch (e) {
    logger.error('Error starting builder:');
    logger.error(e);
}
