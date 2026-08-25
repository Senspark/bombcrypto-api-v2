import {Express, NextFunction, Request, Response, Router} from "express";
import bodyParser from "body-parser";
import simpleHandlers from "./routers/SimpleHandlers";
import WebhookHandler from "./routers/WebhookHandler";
import SitesHandler from "./routers/SitesHandler";
import TriggerHandler from "./routers/TriggerHandler";
import BuildsHandler from "./routers/BuildsHandler";
import extendResponse from "./consts/ExpressExtension";
import ILogger from "./services/ILogger";
import IHookIpFilter from "./services/IHookIpFilter";

function setupStandardModules(app: Express, logger: ILogger) {
    app.use(bodyParser.json({
        // A push touching many files easily passes the 32kb other services use.
        limit: '1mb',
        verify: (req: Request, _res, buf) => {
            req.rawBody = buf;
        },
    }));

    const responseLogger = logger.clone('[RES]');
    app.use((_req: Request, res: Response, next: NextFunction) => {
        extendResponse(responseLogger, res);
        next();
    });
}

// Mounted before the body parser: an address that is not allowed to post here
// should not get a megabyte of JSON parsed on its behalf first.
function setupHookIpFilter(app: Express, filter: IHookIpFilter) {
    app.use('/api/hooks', (req: Request, res: Response, next: NextFunction) => {
        if (filter.allow(req.header('cf-connecting-ip'))) {
            next();
            return;
        }
        res.status(403).json({error: 'FORBIDDEN'});
    });
}

function setupBasicRoutes(app: Express) {
    app.get('/health', simpleHandlers.healthCheckHandler);
}

function setupReceiverRoutes(router: Router, webhook: WebhookHandler, sites: SitesHandler) {
    router.post('/hooks/:site', webhook.handle);
    router.get('/sites', sites.list);
}

function setupBuilderRoutes(router: Router, trigger: TriggerHandler, builds: BuildsHandler) {
    router.post('/trigger', trigger.handle);
    router.get('/builds', builds.list);
}

const Routes = {
    setupHookIpFilter,
    setupStandardModules,
    setupBasicRoutes,
    setupReceiverRoutes,
    setupBuilderRoutes,
};

export default Routes;
