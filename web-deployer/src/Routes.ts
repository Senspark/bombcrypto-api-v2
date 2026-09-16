import {Express, NextFunction, Request, Response, Router} from "express";
import bodyParser from "body-parser";
import simpleHandlers from "./routers/SimpleHandlers";
import WebhookHandler from "./routers/WebhookHandler";
import SitesHandler from "./routers/SitesHandler";
import TriggerHandler from "./routers/TriggerHandler";
import PreviewHandler from "./routers/PreviewHandler";
import RollbackHandler from "./routers/RollbackHandler";
import AuthHandler from "./routers/AuthHandler";
import ReleaseHandler from "./routers/ReleaseHandler";
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

function setupReceiverRoutes(
    router: Router,
    webhook: WebhookHandler,
    sites: SitesHandler,
    auth: AuthHandler,
    release: ReleaseHandler,
) {
    router.post('/hooks/:site', webhook.handle);
    router.get('/sites', sites.list);

    router.post('/auth/google', auth.login);
    router.post('/auth/logout', auth.logout);
    router.get('/auth/me', auth.me);

    // The one endpoint here that writes a production web root, and the only one
    // that needs a signed-in operator behind it.
    router.post('/rollback/:site', auth.require, release.rollback);
}

function setupBuilderRoutes(
    router: Router,
    trigger: TriggerHandler,
    preview: PreviewHandler,
    rollback: RollbackHandler,
    builds: BuildsHandler,
) {
    router.post('/trigger', trigger.handle);
    router.post('/preview', preview.handle);
    router.post('/rollback', rollback.handle);
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
