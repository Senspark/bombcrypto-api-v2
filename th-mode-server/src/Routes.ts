import express, {Express, NextFunction, Request, Response, Router} from "express";
import simpleHandlers from "./routers/SimpleHandlers";
import LeaderBoardHandler from "./routers/LeaderBoardHandler";
import cors from "cors";
import bodyParser from "body-parser";
import extendResponse from "./consts/ExpressExtension";
import IEnvConfig from "./services/IEnvConfig";
import ILogger from "./services/ILogger";
import {envConfig, logger} from "./Server";

function setupStandardModules(app: Express, logger: ILogger, envConfig: IEnvConfig) {
    app.use(cors()); // Enable CORS
    app.use(bodyParser.json({limit: '10kb'})); // Limit request bodies
    app.use(bodyParser.urlencoded({limit: '1kb', extended: true})); // Limit URL-encoded bodies

    // Extension method
    const responseLogger = logger.clone('[RESPONSE]');
    app.use((req: Request, res: Response, next: NextFunction) => {
        extendResponse(responseLogger, res);
        next();
    });
}

function setupBasicRoutes(app: Express) {
    app.get(`/`, simpleHandlers.healthCheckHandler);
    app.get(`/health`, simpleHandlers.healthCheckHandler);
}

function setupLeaderBoardRoutes(
    router: Router,
    leaderboardHandler: LeaderBoardHandler
) {
    router.get(`/`, simpleHandlers.healthCheckHandler);
    router.get(`/leaderboard`, isAllowFetchThModeData, leaderboardHandler.exportData.bind(leaderboardHandler));
}

/**
 * Only the host in env is allowed to call this API
 * Each IP is allowed to call at most 5 times within 5 seconds
 * @param req
 * @param res
 * @param next
 */
function isAllowFetchThModeData(req: express.Request, res: express.Response, next: express.NextFunction) {
    const referrer = req.headers['referer'];
    const linkClient = envConfig.clientThModePath;
    if (referrer) {
        if (linkClient !== '' && !referrer.startsWith(linkClient)) {
            logger.info(`Invalid Client: ${linkClient}, disallow to access`);    
            return res.sendError('Bad Request', 400);
        }
        // logger.info(`Valid Client: ${linkClient}, allow to access`);
        const isIpAllowed = checkIp(req);
        if (!isIpAllowed) {
            const ip = (req.headers['x-forwarded-for'] || req.ip || 'unknown').toString().split(',')[0];
            logger.info(`Rate limit exceeded — IP: ${ip}, ${req.method} ${req.url}`);
            return res.sendError('Bad Request', 400);
        }
        return next();
    } else {
        logger.info(`Bad referrer: ${referrer} — ${req.method} ${req.url}`);
        res.sendError('Bad Request', 400);
    }
}

const ipRequestMap: Map<string, number[]> = new Map();

function checkIp(req: express.Request): Boolean {
    const forwardedIp = req.headers['x-forwarded-for'];
    let ip = req.ip;
    if (forwardedIp) {
        ip = forwardedIp.toString().split(',')[0];
    }
    if (!ip) {
        logger.error("IP not found");
        return false;
    }
    // Each IP can only call this endpoint at most 5 times within 5 seconds
    const now = Date.now();
    const windowMs = 5000;
    let timestamps = ipRequestMap.get(ip) || [];
    // Remove timestamps older than 5 seconds for this user
    timestamps = timestamps.filter(ts => now - ts < windowMs);
    if (timestamps.length >= 5) {
        logger.info(`IP ${ip} exceeded rate limit`);
        return false;
    }
    timestamps.push(now);
    ipRequestMap.set(ip, timestamps);
    return true;
}


const Routes = {
    setupBasicRoutes,
    setupLeaderBoardRoutes,
    setupStandardModules,
};

export default Routes;
