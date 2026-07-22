import {Response} from 'express';
import ILogger from "../services/ILogger";

declare module 'express-serve-static-core' {
    interface Response {
        sendOk(data: any): void;

        sendErr(message: string, errCode?: number, extra?: Record<string, any>): void;
    }
}

export {};

export default function extendResponse(logger: ILogger, res: Response) {
    res.sendOk = function (data: any) {
        this.status(200).json(data);
    };

    res.sendErr = function (message: string, errCode?: number, extra?: Record<string, any>) {
        const body: Record<string, any> = {error: message};
        if (extra) Object.assign(body, extra);
        logger.error(`${errCode ?? 400} ${message}`);
        this.status(errCode || 400).json(body);
    };
}
