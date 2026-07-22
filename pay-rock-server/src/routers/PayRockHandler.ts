import {Request, Response} from "express";
import ILogger from "../services/ILogger";
import IBlockchainApiClient from "../services/IBlockchainApiClient";
import IPreviewStore, {IPreviewBody, IPreviewItem} from "../services/IPreviewStore";
import IPayRockRepository from "../services/IPayRockRepository";
import {Network} from "../consts/Consts";
import {decodeHeroDetails} from "../utils/HeroUtils";
import {BlockchainApiError} from "../services-impl/BlockchainApiClient";

const TX_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;

export default class PayRockHandler {
    readonly #logger: ILogger;
    readonly #blockchainApi: IBlockchainApiClient;
    readonly #previewStore: IPreviewStore;
    readonly #repo: IPayRockRepository;
    readonly #ttlSeconds: number;

    constructor(
        logger: ILogger,
        blockchainApi: IBlockchainApiClient,
        previewStore: IPreviewStore,
        repo: IPayRockRepository,
        ttlSeconds: number,
    ) {
        this.#logger = logger.clone('[PayRock]');
        this.#blockchainApi = blockchainApi;
        this.#previewStore = previewStore;
        this.#repo = repo;
        this.#ttlSeconds = ttlSeconds;
    }

    preview = async (req: Request, res: Response): Promise<void> => {
        const parsed = this.#parseTxNetwork(req.body);
        if ('error' in parsed) {
            res.sendErr(parsed.error, 400);
            return;
        }
        const {tx, network} = parsed;

        try {
            const cached = await this.#previewStore.get(tx, network);
            if (cached) {
                this.#logger.info(`preview cache HIT tx=${tx} network=${network}`);
                res.sendOk(cached);
                return;
            }

            const item = await this.#buildItem(tx, network);
            const totalRock = item.status === 'PAYABLE' ? item.rockAmount : 0;
            const expiresAt = Math.floor(Date.now() / 1000) + this.#ttlSeconds;
            const body: IPreviewBody = {
                expiresAt,
                input: {tx, network},
                summary: {totalRock},
                items: [item],
            };
            // Skip caching transient upstream errors — user should be able to retry.
            if (item.status !== 'ERROR_BLOCKCHAIN_API') {
                await this.#previewStore.save(body);
            }
            this.#logger.info(
                `preview cache MISS tx=${tx} network=${network} status=${item.status} totalRock=${totalRock}`,
            );
            res.sendOk(body);
        } catch (e) {
            this.#logger.error(`preview failed: ${(e as Error).message}`);
            res.sendErr('INTERNAL', 500);
        }
    };

    confirm = async (req: Request, res: Response): Promise<void> => {
        const parsed = this.#parseTxNetwork(req.body);
        if ('error' in parsed) {
            res.sendErr(parsed.error, 400);
            return;
        }
        const {tx, network} = parsed;
        const acceptedRock = Number(req.body?.acceptedRock);
        if (!Number.isFinite(acceptedRock)) {
            res.sendErr('acceptedRock required (number)', 400);
            return;
        }

        const body = await this.#previewStore.consume(tx, network);
        if (!body) {
            res.sendErr('PREVIEW_NOT_FOUND', 410);
            return;
        }
        if (body.summary.totalRock !== acceptedRock) {
            res.sendErr('ROCK_AMOUNT_MISMATCH', 409, {
                expected: body.summary.totalRock,
                received: acceptedRock,
            });
            return;
        }

        const processed: Array<{ tx: string; network: Network; rockAmount: number; status: 'PAID' }> = [];
        const skipped: Array<{ tx: string; status: 'ALREADY_PAID' }> = [];
        const failed: Array<{ tx: string; status: 'ERROR_DB'; message: string }> = [];
        let totalRockCredited = 0;
        const summaryWallet: string | null = body.items.find(i => i.wallet)?.wallet ?? null;
        let rockBefore: number | null = null;
        let rockAfter: number | null = null;

        if (summaryWallet) {
            try {
                rockBefore = await this.#repo.getUserRockBalance(summaryWallet);
            } catch (e) {
                this.#logger.error(`getUserRockBalance(before) failed ${summaryWallet}: ${(e as Error).message}`);
            }
        }

        for (const item of body.items) {
            if (item.status !== 'PAYABLE') continue;
            if (!item.wallet) {
                failed.push({tx: item.tx, status: 'ERROR_DB', message: 'wallet missing on item'});
                continue;
            }
            try {
                const existing = await this.#repo.findExistingRockTx(item.tx, item.network);
                if (existing?.status === 'DONE') {
                    skipped.push({tx: item.tx, status: 'ALREADY_PAID'});
                    continue;
                }
                await this.#repo.creditRock(item.wallet, item.tx, item.heroIds, item.rockAmount, item.network);
                processed.push({tx: item.tx, network: item.network, rockAmount: item.rockAmount, status: 'PAID'});
                totalRockCredited += item.rockAmount;
            } catch (e) {
                this.#logger.error(`creditRock failed ${item.tx}/${item.network}: ${(e as Error).message}`);
                failed.push({tx: item.tx, status: 'ERROR_DB', message: (e as Error).message});
            }
        }

        if (summaryWallet) {
            try {
                rockAfter = await this.#repo.getUserRockBalance(summaryWallet);
            } catch (e) {
                this.#logger.error(`getUserRockBalance(after) failed ${summaryWallet}: ${(e as Error).message}`);
            }
        }

        this.#logger.info(
            `confirm tx=${tx} network=${network} wallet=${summaryWallet} paid=${processed.length} skipped=${skipped.length} failed=${failed.length} rock=${rockBefore}→${rockAfter}`,
        );

        res.sendOk({
            processed,
            skipped,
            failed,
            summary: {
                wallet: summaryWallet,
                totalRockCredited,
                rockBefore,
                rockAfter,
                paidCount: processed.length,
                skippedCount: skipped.length,
                failedCount: failed.length,
            },
        });
    };

    // -------------------- internals --------------------

    #parseTxNetwork(body: any): { tx: string; network: Network } | { error: string } {
        if (!body || typeof body !== 'object') return {error: 'invalid body'};
        const rawTx = typeof body.tx === 'string' ? body.tx.trim() : '';
        const rawNetwork = typeof body.network === 'string' ? body.network.toUpperCase() : '';

        if (!rawTx) return {error: 'tx is required'};
        if (!TX_HASH_REGEX.test(rawTx)) return {error: 'tx must be 0x + 64 hex'};
        if (!rawNetwork) return {error: 'network is required (BSC or POLYGON)'};
        if (rawNetwork !== Network.BSC && rawNetwork !== Network.POLYGON) {
            return {error: `invalid network: ${rawNetwork}`};
        }
        return {tx: rawTx.toLowerCase(), network: rawNetwork as Network};
    }

    async #buildItem(tx: string, network: Network): Promise<IPreviewItem> {
        const heroConfig = await this.#repo.getBurnHeroConfig();
        const item: IPreviewItem = {
            tx,
            network,
            wallet: null,
            heroIds: [],
            rockAmount: 0,
            status: 'PAYABLE',
        };

        const existing = await this.#repo.findExistingRockTx(tx, network);
        if (existing?.status === 'DONE') {
            item.status = 'ALREADY_PAID';
            item.rockAmount = existing.rockAmount;
            item.heroIds = existing.heroIds;
            return item;
        }

        let burnTx;
        try {
            burnTx = await this.#blockchainApi.queryRockBurnTx(tx, network);
        } catch (e) {
            item.status = 'ERROR_BLOCKCHAIN_API';
            item.message = (e as BlockchainApiError).message;
            return item;
        }
        if (!burnTx) {
            item.status = 'INVALID_NOT_BURN';
            return item;
        }
        item.wallet = burnTx.wallet_address.toLowerCase();
        item.heroIds = burnTx.hero_ids;

        const genIds = await this.#repo.findHeroGenIds(burnTx.hero_ids, network);
        if (!genIds.length) {
            item.status = 'INVALID_NO_HERO_DATA';
            return item;
        }

        let rock = 0;
        for (const genId of genIds) {
            const decoded = decodeHeroDetails(genId);
            const config = heroConfig.get(decoded.rarity);
            if (!config) continue;
            rock += decoded.isHeroS ? config[0] : config[1];
        }
        if (rock <= 0) {
            item.status = 'INVALID_ZERO_ROCK';
            return item;
        }
        item.rockAmount = rock;
        const wallet = item.wallet;
        if (wallet) {
            try {
                item.currentRock = await this.#repo.getUserRockBalance(wallet);
            } catch (e) {
                this.#logger.error(`getUserRockBalance failed ${wallet}: ${(e as Error).message}`);
            }
        }
        return item;
    }
}
