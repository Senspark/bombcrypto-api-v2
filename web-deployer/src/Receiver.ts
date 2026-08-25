import express from "express";
import cors from "cors";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import Routes from "./Routes";
import ReceiverDependencies from "./ReceiverDependencies";
import WebhookHandler from "./routers/WebhookHandler";
import SitesHandler from "./routers/SitesHandler";

const dependencies = new ReceiverDependencies();
const logger = dependencies.logger;

const webhookHandler = new WebhookHandler(logger, dependencies.registry, dependencies.secrets, dependencies.builder);
const sitesHandler = new SitesHandler(logger, dependencies.registry, dependencies.poller);

try {
    const app = express();
    app.use(cors());

    Routes.setupHookIpFilter(app, dependencies.hookIpFilter);
    Routes.setupStandardModules(app, logger);

    const apiRouter = express.Router();
    app.use('/api', apiRouter);

    Routes.setupBasicRoutes(app);
    Routes.setupReceiverRoutes(apiRouter, webhookHandler, sitesHandler);

    app.use(express.static(join(dirname(fileURLToPath(import.meta.url)), '..', 'public')));

    dependencies.hookIpFilter.start();
    dependencies.poller.start();

    app.listen(dependencies.config.port, () => {
        logger.info(`receiver started at http://localhost:${dependencies.config.port}`);
    });
} catch (e) {
    logger.error('Error starting receiver:');
    logger.error(e);
}
