import {Request, Response} from "express";
import * as fs from "fs";
import * as path from "path";
import {IEnvConfig, ILogger} from "../Services";

type RpcType = "bsc" | "polygon";

class RpcHandlers {
    private rpcCache: Record<RpcType, string[]> = {
        bsc: [],
        polygon: [],
    };

    private logger: ILogger;
    private envConfig: IEnvConfig;

    constructor(logger: ILogger, envConfig: IEnvConfig) {
        this.logger = logger.clone('[RpcHandlers]');
        this.envConfig = envConfig;
    }

    init(): void {
        const variant = this.envConfig.isProduction ? 'mainnet' : 'testnet';
        try {
            this.rpcCache.bsc = this.loadRpcFile("bsc");
            this.logger.info(`------------------ Loaded bsc ${variant} RPC endpoints: ------------------`);
            this.rpcCache.bsc.forEach((endpoint, idx) => {
                this.logger.info(`[bsc RPC #${idx + 1}] ${endpoint}`);
            });

            this.rpcCache.polygon = this.loadRpcFile("polygon");
            this.logger.info(`------------------ Loaded polygon ${variant} RPC endpoints: ------------------`);
            this.rpcCache.polygon.forEach((endpoint, idx) => {
                this.logger.info(`[polygon RPC #${idx + 1}] ${endpoint}`);
            });
        } catch (error) {
            this.logger.error(`[RpcHandlers] init failed: ${error}`);
        }
    }

    private loadRpcFile(type: RpcType): string[] {
        const suffix = this.envConfig.isProduction ? '_rpc.txt' : '_testnet_rpc.txt';
        const fileName = `${type}${suffix}`;
        const filePath = path.resolve("./data", fileName);
        this.logger.info(`[RpcHandlers] init filePath: ${filePath}`);
        const content = fs.readFileSync(filePath, "utf-8");
        return content
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
    }

    private getRpcList(type: RpcType): string[] {
        return this.rpcCache[type];
    }

    bscRpcHandler = (req: Request, res: Response) => {
        res.sendRawJson(this.getRpcList("bsc"));
    };

    polygonRpcHandler = (req: Request, res: Response) => {
        res.sendRawJson(this.getRpcList("polygon"));
    };
}

export default RpcHandlers;
