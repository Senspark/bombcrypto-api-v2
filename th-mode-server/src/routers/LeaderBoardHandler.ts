import LeaderBoardController from "../services-impl/LeaderBoardController";
import {IDependencies, ILeaderBoardController} from "../Services";
import ILogger from "../services/ILogger";
import {IHeroInfo} from "../consts/Consts";
import RewardPoolRepository, {IRewardPoolInfo} from "../services-impl/RewardPoolRepository";
import {Request, Response} from "express";

export default class LeaderBoardHandler {
    #logger: ILogger;
    #leaderboard: ILeaderBoardController;
    #rewardPoolRepo: RewardPoolRepository;

    #cached: {raceId: number; groupedData: Array<IHeroInfo[]>} = {raceId: 0, groupedData: []};

    constructor(dependencies: IDependencies, rewardPoolRepo: RewardPoolRepository) {
        this.#logger = dependencies.logger.clone('[APP]');
        this.#rewardPoolRepo = rewardPoolRepo;
        this.#leaderboard = new LeaderBoardController(
            dependencies.logger,
            dependencies.messenger,
            dependencies.realtimeIndex,
            this.updateNewData.bind(this),
        );
    }

    get currentRaceId(): number {
        return this.#leaderboard.currentRaceId;
    }

    async exportData(req: Request, res: Response) {
        let rewardPools: IRewardPoolInfo[] = [];
        try {
            rewardPools = await this.#rewardPoolRepo.getRewardPools();
        } catch (e) {
            this.#logger.error(e);
        }
        const result: IExportDataForModerator = {
            raceId: this.#cached.raceId,
            groupedData: this.#cached.groupedData,
            rewardPools,
        };
        res.sendSuccess(result);
    }


    private updateNewData() {
        this.#cached = {
            raceId: this.#leaderboard.currentRaceId,
            groupedData: this.#leaderboard.exportData(),
        };
    }
}

interface IExportDataForModerator {
    raceId: number;
    groupedData: Array<IHeroInfo[]>;
    rewardPools: IRewardPoolInfo[];
}
