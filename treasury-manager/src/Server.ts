import cookieParser from "cookie-parser";
import {formatEther} from "ethers";
import express from "express";
import {RedisClientType} from "redis";
import Dependencies from "./Dependencies.js";
import {BSC_CHAIN_ID, POLYGON_CHAIN_ID} from "./consts/Consts.js";
import {buildAuthMiddleware, buildAuthRouter} from "./routers/AuthRouter.js";
import buildNativeStatsRouter from "./routers/NativeStatsRouter.js";
import buildScheduleRouter from "./routers/ScheduleRouter.js";
import SnapshotTicker from "./scheduler/SnapshotTicker.js";
import Ticker from "./scheduler/Ticker.js";
import AuthService from "./services-impl/AuthService.js";
import ChainClients from "./services-impl/ChainClients.js";
import NativeStatsRepository from "./services-impl/NativeStatsRepository.js";
import NativeStatsService from "./services-impl/NativeStatsService.js";
import NativeStatsStore from "./services-impl/NativeStatsStore.js";
import getPgPool from "./services-impl/PostgresClient.js";
import getRedisClient from "./services-impl/Redis.js";
import ScheduleStore from "./services-impl/ScheduleStore.js";
import SwapExecutor from "./services-impl/SwapExecutor.js";

const dependencies = new Dependencies();
const logger = dependencies.logger;
const envConfig = dependencies.envConfig;

try {
    if (!envConfig.authEnabled) {
        logger.warn("AUTH DISABLED (IS_GCLOUD=false) — every request is treated as a signed-in operator.");
    }

    const redis = getRedisClient(envConfig.redisConnectionString) as RedisClientType;
    const clients = new ChainClients(envConfig);
    const store = new ScheduleStore(logger, redis);
    const executor = new SwapExecutor(logger, clients, envConfig);
    const auth = new AuthService(logger, envConfig, redis);
    const ticker = new Ticker(logger, store, executor, envConfig);

    // The game database is the only source for what users have already spent, so without it the
    // withdrawable surplus cannot be told apart from money still owed to depositors.
    let stats: NativeStatsService | null = null;
    let snapshotTicker: SnapshotTicker | null = null;
    if (envConfig.databaseUrl) {
        stats = new NativeStatsService(
            logger,
            new NativeStatsRepository(logger, getPgPool(envConfig.databaseUrl)),
            new NativeStatsStore(logger, redis),
            envConfig.nativeStatsTtlSeconds,
            envConfig.snapshotTimeZone,
        );
        snapshotTicker = new SnapshotTicker(logger, stats);
    } else {
        logger.warn("DATABASE_URL is empty — DepositNative reporting is off, schedules are unaffected.");
    }

    logger.info(`manager wallet ${clients.managerAddress}`);
    void reportGas(clients);

    const app = express();
    app.use(express.json({limit: "1mb"}));
    app.use(cookieParser());

    app.get("/health", (_req, res) => {
        res.json({ok: true, version: envConfig.appVersion, manager: clients.managerAddress});
    });

    // auth_request target. nginx rewrites the URI to /verify, so it is mounted outside /treasury.
    app.get("/verify", (req, res) => {
        auth.resolve(req.cookies?.tm_session)
            .then((email) => res.status(email ? 204 : 401).end())
            .catch(() => res.status(401).end());
    });

    app.use("/treasury/auth", buildAuthRouter(logger, auth, envConfig.isProduction));
    const requireAuth = buildAuthMiddleware(logger, auth, envConfig.isProduction);
    // Mounted first: /treasury would otherwise take the more specific path through the schedule
    // router before reaching this one.
    if (stats) {
        app.use("/treasury/native", requireAuth, buildNativeStatsRouter(logger, stats));
    }
    app.use("/treasury", requireAuth, buildScheduleRouter(logger, store, executor));

    ticker.start();
    snapshotTicker?.start();

    const server = app.listen(envConfig.port, () => {
        logger.info(`treasury-manager listening on ${envConfig.port} (version ${envConfig.appVersion})`);
    });

    const shutdown = () => {
        logger.info("shutting down...");
        ticker.stop();
        snapshotTicker?.stop();
        server.close();
        process.exit(0);
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
} catch (e) {
    logger.error("Error starting treasury-manager:");
    logger.error(e);
    process.exit(1);
}

async function reportGas(clients: ChainClients): Promise<void> {
    for (const chainId of [BSC_CHAIN_ID, POLYGON_CHAIN_ID]) {
        try {
            const balance = await clients.nativeBalance(chainId);
            logger.info(`chain ${chainId} native balance ${formatEther(balance)}`);
        } catch (e) {
            logger.error(`chain ${chainId} balance read failed:`);
            logger.error(e);
        }
    }
}
