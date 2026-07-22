import express, {Express, NextFunction, Request, Response} from "express";
import cors from "cors";
import simpleHandlers from "./routers/SimpleHandlers";
import CreateShareHandler from "./routers/CreateShareHandler";
import RenderShareHandler from "./routers/RenderShareHandler";
import AdminDeleteHandler from "./routers/AdminDeleteHandler";
import extendResponse from "./consts/ExpressExtension";
import {JSON_BODY_LIMIT} from "./consts/Consts";
import ILogger from "./services/ILogger";
import IEnvConfig from "./services/IEnvConfig";

function setupStandardModules(app: Express, logger: ILogger, envConfig: IEnvConfig) {
    // CORS is not a security control (auth + rate-limit are). Empty allowlist => reflect.
    const corsOpts = envConfig.corsOrigins.length > 0
        ? {origin: envConfig.corsOrigins, credentials: true}
        : {origin: true, credentials: true};
    app.use(cors(corsOpts));

    app.use(express.json({limit: JSON_BODY_LIMIT}));

    const responseLogger = logger.clone('[RESPONSE]');
    app.use((req: Request, res: Response, next: NextFunction) => {
        extendResponse(responseLogger, res);
        next();
    });
}

function setupRoutes(
    app: Express,
    createHandler: CreateShareHandler,
    renderHandler: RenderShareHandler,
    adminHandler: AdminDeleteHandler,
) {
    app.get(`/`, simpleHandlers.healthCheckHandler);
    app.get(`/health`, simpleHandlers.healthCheckHandler);

    // Render is public (/share/); management is reached via the /api/ proxy only.
    app.get(`/share/:id`, renderHandler.render.bind(renderHandler));
    app.post(`/create`, createHandler.create.bind(createHandler));
    app.delete(`/admin/:id`, adminHandler.deleteShare.bind(adminHandler));
}

const Routes = {
    setupStandardModules,
    setupRoutes,
};

export default Routes;
