import {Request, Response} from "express";
import ILogger from "../services/ILogger";
import WalletResolver from "../services-impl/WalletResolver";
import WatchRepository from "../services-impl/WatchRepository";
import RealtimeIndex from "../services-impl/RealtimeIndex";
import LeaderBoardHandler from "./LeaderBoardHandler";

const MAX_WALLET_LEN = 100;     // matches public."user".user_name varchar(100)

export default class WatchHandler {
    readonly #logger: ILogger;
    readonly #walletResolver: WalletResolver;
    readonly #watchRepo: WatchRepository;
    readonly #realtimeIndex: RealtimeIndex;
    readonly #leaderboardHandler: LeaderBoardHandler;

    constructor(
        logger: ILogger,
        walletResolver: WalletResolver,
        watchRepo: WatchRepository,
        realtimeIndex: RealtimeIndex,
        leaderboardHandler: LeaderBoardHandler,
    ) {
        this.#logger = logger.clone('[Watch]');
        this.#walletResolver = walletResolver;
        this.#watchRepo = watchRepo;
        this.#realtimeIndex = realtimeIndex;
        this.#leaderboardHandler = leaderboardHandler;
    }

    async exportData(req: Request, res: Response) {
        const rawWallet = req.params.wallet;
        if (typeof rawWallet !== 'string' || rawWallet.length === 0 || rawWallet.length > MAX_WALLET_LEN) {
            return res.sendError('Bad Request', 400);
        }

        try {
            const resolved = await this.#walletResolver.resolve(rawWallet);
            if (!resolved) {
                return res.sendError('Wallet not found', 404);
            }

            const [activeHeroes, pendingRewards, dailyEarnings] = await Promise.all([
                this.#watchRepo.getActiveHeroes(resolved.uid),
                this.#watchRepo.getPendingRewards(resolved.uid),
                this.#watchRepo.getDailyEarnings(resolved.uid),
            ]);

            const currentRaceHeroes = this.#realtimeIndex.getByUid(resolved.uid);

            this.#logger.info(`wallet=${rawWallet} uid=${resolved.uid} active=${activeHeroes.length} pending=${pendingRewards.length} daily=${dailyEarnings.length} race=${currentRaceHeroes.length}`);

            res.sendSuccess({
                wallet: rawWallet.toLowerCase(),
                uid: resolved.uid,
                userName: resolved.userName,
                activeHeroes,
                pendingRewards,
                dailyEarnings,
                currentRace: {
                    raceId: this.#leaderboardHandler.currentRaceId,
                    heroes: currentRaceHeroes,
                },
            });
        } catch (e) {
            this.#logger.error(e);
            res.sendGenericError();
        }
    }
}
