import express from "express";
import {createServer} from "http";
import bodyParser from "body-parser";
import cors from "cors";
import {AddressInfo} from "net";
import simpleHandlers from "./routers/SimpleHandlers";
import * as Dependencies from "./Dependencies";
import extendResponse from "./consts/ExpressExtension";
import helmet from "helmet";
import { getLocalIp } from "./utils/NetworkUtils";
import RpcHandlers from "./routers/RpcHandlers";

const dependencies = Dependencies.initDependencies();
const logger = dependencies.logger;
const envConfig = dependencies.envConfig;

const rpcHandlers = new RpcHandlers(logger, envConfig);
rpcHandlers.init();

const app = express();
const router = express.Router();

app.use(bodyParser.json({limit: '1kb'}));
app.use(bodyParser.urlencoded({limit: '1kb', extended: true}));

// Extension method
app.use((req, res, next) => {
    extendResponse(res);
    next();
});

app.use(helmet());

router.get(`/`, simpleHandlers.healthCheckHandler);
router.get(`/bsc`, rpcHandlers.bscRpcHandler);
router.get(`/polygon`, rpcHandlers.polygonRpcHandler);

app.use(`/rpc`, router);
app.get(`/`, simpleHandlers.healthCheckHandler);
app.get(`/health`, simpleHandlers.healthCheckHandler);

const server = createServer(app).listen(
    envConfig.port,
    '0.0.0.0',
    () => {
        const address = server.address() as AddressInfo;
        const localIp = getLocalIp();
        logger.info(`Server started at http://${localIp}:${address.port} (LAN)`);
        logger.info(`Server also accessible at http://localhost:${address.port}`);
    }
);