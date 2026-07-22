import {Request, Response} from "express";
import {randomUUID} from "node:crypto";
import {IDependencies} from "../Services";
import ILogger from "../services/ILogger";
import {ShareRecord} from "../services/IShareStore";
import {HeroTuple} from "../text/TweetComposer";
import {ValidationError} from "../consts/ServerError";
import {MAX_HEROES, SHARE_SOURCES} from "../consts/Consts";

interface ValidatedBody {
    image: string;
    source: string;
    heroes: HeroTuple[];
    token?: string;
    amount?: number;
}

export default class CreateShareHandler {
    readonly #logger: ILogger;
    readonly #dep: IDependencies;

    constructor(dependencies: IDependencies) {
        this.#dep = dependencies;
        this.#logger = dependencies.logger.clone('[CREATE]');
    }

    async create(req: Request, res: Response) {
        const auth = await this.#dep.authVerifier.verify(req.headers['authorization']);
        if (!auth) {
            return res.sendError('Unauthorized', 401);
        }
        const wallet = auth.wallet;

        const allowed = await this.#dep.rateLimiter.hit(wallet);
        if (!allowed) {
            return res.sendError('Too many shares today', 429);
        }

        let body: ValidatedBody;
        try {
            body = this.validate(req.body);
        } catch (e) {
            if (e instanceof ValidationError) {
                return res.sendError(e.message, 400);
            }
            this.#logger.error(e);
            return res.sendGenericError();
        }

        try {
            const id = randomUUID();
            const jpeg = await this.#dep.imageProcessor.process(body.image);
            await this.#dep.imageStore.save(id, jpeg);

            const composed = this.#dep.tweetComposer.compose({
                source: body.source,
                heroes: body.heroes,
                token: body.token,
                amount: body.amount,
            });

            const record: ShareRecord = {
                source: body.source,
                title: composed.title,
                description: composed.description,
                text: composed.text,
                wallet,
                createdAt: Date.now(),
            };
            await this.#dep.shareStore.save(id, record);

            try {
                await this.#dep.analyticsStore.record(id, record);
            } catch (e) {
                this.#logger.error(`analytics record failed id=${id}: ${e}`);
            }

            const baseUrl = this.#dep.envConfig.shareBaseUrl;
            const url = `${baseUrl}/share/${id}`;

            this.#dep.slackNotifier.notify({
                wallet,
                url,
                imageUrl: `${this.#dep.envConfig.imageUrlBase}/${id}.jpg`,
                text: composed.text,
            });

            this.#logger.info(`wallet=${wallet} source=${body.source} id=${id}`);

            return res.sendSuccess({url, text: composed.text});
        } catch (e) {
            if (e instanceof ValidationError) {
                return res.sendError(e.message, 400);
            }
            this.#logger.error(e);
            return res.sendGenericError();
        }
    }

    private validate(raw: any): ValidatedBody {
        if (!raw || typeof raw !== 'object') {
            throw new ValidationError('Missing body');
        }
        if (typeof raw.image !== 'string' || raw.image.length === 0) {
            throw new ValidationError('Missing image');
        }
        if (typeof raw.source !== 'string' || !SHARE_SOURCES.includes(raw.source)) {
            throw new ValidationError('Invalid source');
        }

        const heroes = this.validateHeroes(raw.heroes);

        let amount: number | undefined;
        if (raw.amount !== undefined && raw.amount !== null) {
            if (typeof raw.amount !== 'number' || !Number.isFinite(raw.amount) || raw.amount < 0) {
                throw new ValidationError('Invalid amount');
            }
            amount = raw.amount;
        }

        const token = typeof raw.token === 'string' ? raw.token : undefined;

        return {image: raw.image, source: raw.source, heroes, token, amount};
    }

    private validateHeroes(raw: any): HeroTuple[] {
        if (raw === undefined || raw === null) {
            return [];
        }
        if (!Array.isArray(raw)) {
            throw new ValidationError('Invalid heroes');
        }
        if (raw.length > MAX_HEROES) {
            throw new ValidationError('Too many heroes');
        }
        return raw.map((tuple: any) => {
            if (!Array.isArray(tuple) || tuple.length !== 3
                || !tuple.every((n: any) => typeof n === 'number' && Number.isFinite(n))) {
                throw new ValidationError('Invalid hero tuple');
            }
            return [tuple[0], tuple[1], tuple[2]] as HeroTuple;
        });
    }
}
