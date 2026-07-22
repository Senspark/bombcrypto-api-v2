import {Request, Response} from "express";
import {IDependencies} from "../Services";
import ILogger from "../services/ILogger";
import {UUID_V4_REGEX} from "../consts/Consts";

export default class AdminDeleteHandler {
    readonly #logger: ILogger;
    readonly #dep: IDependencies;

    constructor(dependencies: IDependencies) {
        this.#dep = dependencies;
        this.#logger = dependencies.logger.clone('[ADMIN]');
    }

    async deleteShare(req: Request, res: Response) {
        const expected = this.#dep.envConfig.adminToken;
        const provided = req.headers['x-admin-token'];
        // Empty ADMIN_TOKEN disables the endpoint.
        if (!expected || provided !== expected) {
            return res.sendError('Forbidden', 403);
        }

        const id = req.params.id;
        if (typeof id !== 'string' || !UUID_V4_REGEX.test(id)) {
            return res.sendError('Invalid id', 400);
        }

        try {
            await this.#dep.shareStore.delete(id);
            await this.#dep.imageStore.delete(id);
            this.#logger.info(`deleted share ${id}`);
            return res.sendSuccess({deleted: id});
        } catch (e) {
            this.#logger.error(e);
            return res.sendGenericError();
        }
    }
}
