import {Express, NextFunction, Request, Response, Router} from "express";
import bodyParser from "body-parser";
import simpleHandlers from "./routers/SimpleHandlers";
import PayRockHandler from "./routers/PayRockHandler";
import extendResponse from "./consts/ExpressExtension";
import ILogger from "./services/ILogger";

function setupStandardModules(app: Express, logger: ILogger) {
    app.use(bodyParser.json({limit: '32kb'}));
    app.use(bodyParser.urlencoded({limit: '1kb', extended: true}));

    const responseLogger = logger.clone('[RES]');
    app.use((_req: Request, res: Response, next: NextFunction) => {
        extendResponse(responseLogger, res);
        next();
    });
}

function setupBasicRoutes(app: Express) {
    app.get('/', simpleHandlers.healthCheckHandler);
    app.get('/health', simpleHandlers.healthCheckHandler);
}

function setupPayRockRoutes(router: Router, handler: PayRockHandler) {
    router.post('/preview', handler.preview);
    router.post('/confirm', handler.confirm);
}

const Routes = {
    setupStandardModules,
    setupBasicRoutes,
    setupPayRockRoutes,
};

export default Routes;
