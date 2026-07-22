import {Request, Response} from "express";
import {IDependencies} from "../Services";
import ILogger from "../services/ILogger";
import {buildSharePage} from "../html/SharePage";
import {UUID_V4_REGEX, HOME_URL} from "../consts/Consts";
import {isCrawler} from "../consts/Crawlers";

// Crawlers get the OG meta page; humans are 302'd home (server-side, no JS — a
// client-side redirect would strip our OG tags from JS-rendering crawlers).
// Response depends only on the validated id + UA + (escaped) record, never req.query/host.
export default class RenderShareHandler {
    readonly #logger: ILogger;
    readonly #dep: IDependencies;

    constructor(dependencies: IDependencies) {
        this.#dep = dependencies;
        this.#logger = dependencies.logger.clone('[RENDER]');
    }

    async render(req: Request, res: Response) {
        const baseUrl = this.#dep.envConfig.shareBaseUrl;
        const home = HOME_URL;

        // Response này KHÁC NHAU theo UA (crawler -> meta, người thật -> 302) nên TUYỆT ĐỐI
        // không được cache. Nếu CDN cache 1 biến thể rồi serve cho mọi UA thì người thật kẹt ở
        // trang meta / crawler bị redirect. no-store áp cho cả 302 lẫn 200.
        res.setHeader('Cache-Control', 'no-store');

        const id = req.params.id;
        if (typeof id !== 'string' || !UUID_V4_REGEX.test(id)) {
            return res.redirect(302, home);
        }

        // Humans bounce straight home — skip Redis, they never need the meta page.
        const userAgent = req.get('user-agent');
        if (!isCrawler(userAgent)) {
            return res.redirect(302, home);
        }

        const ip = req.get('cf-connecting-ip')
            ?? req.get('x-forwarded-for')
            ?? req.socket.remoteAddress
            ?? '?';

        let record;
        try {
            record = await this.#dep.shareStore.get(id);
        } catch (e) {
            this.#logger.error(e);
            return res.redirect(302, home);
        }

        if (!record) {
            this.#logger.info(`crawler hit (no record) id=${id} ip=${ip} ua="${userAgent ?? ''}"`);
            return res.redirect(302, home);
        }

        this.#logger.info(`crawler hit id=${id} ip=${ip} ua="${userAgent ?? ''}"`);

        const html = buildSharePage({
            pageUrl: `${baseUrl}/share/${id}`,
            imageUrl: `${this.#dep.envConfig.imageUrlBase}/${id}.jpg`,
            title: record.title,
            description: record.description,
        });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(html);
    }
}
