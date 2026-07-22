import {Request, Response} from "express";

function healthCheckHandler(req: Request, res: Response) {
    res.status(200).send('ok');
}

const simpleHandlers = {
    healthCheckHandler,
};

export default simpleHandlers;
