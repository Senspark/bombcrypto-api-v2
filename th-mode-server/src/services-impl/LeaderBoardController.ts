import {ILeaderBoardController, ILogger} from "../Services";
import THUtils from "../utils/THModeV2Utils";
import {Channels, HeroRarity, HeroUniqueKey, IHeroInfo} from "../consts/Consts";
import SortedMap from "../utils/SortedMap";
import IMessengerService from "../services/IMessengerService";
import RealtimeIndex from "./RealtimeIndex";
import {removeNameSuffix} from "../utils/UserNameSuffix";

type PoolIndex = HeroRarity;
type LeaderBoard = SortedMap<HeroUniqueKey, IHeroInfo>;

export default class LeaderBoardController implements ILeaderBoardController {
    /**
     * 10 pool theo rarity (Common → SuperMystic)
     */
    #pools: Map<PoolIndex, LeaderBoard> = new Map();

    /**
     * 0 = chưa nhận race nào. raceId lấy từ sequence DB nên chỉ tăng.
     */
    #raceId = 0;

    #logger: ILogger;

    constructor(
        logger: ILogger,
        private readonly _messageService: IMessengerService,
        private readonly _realtimeIndex: RealtimeIndex,
        private readonly _onNewDataUpdated: Function,
    ) {

        const rarities = Object.values(HeroRarity).filter(v => typeof v === 'number') as HeroRarity[];
        for (const rarity of rarities) {
            this.#pools.set(rarity, new SortedMap(leaderBoardDescSort));
        }

        // disable log
        this.#logger = logger;

        this._messageService.subscribe(Channels.SV_TH_MODE_RACE_CHANNEL, this.onThModeRaceBatch.bind(this));
    }

    get currentRaceId() {
        return this.#raceId;
    }

    /**
     * Một batch = mọi hero thay đổi trong ~1 giây, đã sắp theo raceId tăng dần.
     */
    onThModeRaceBatch(data: any) {
        try {
            if (!Array.isArray(data)) {
                this.#logger.error('Invalid TH race batch');
                return;
            }
            let updated = false;
            for (const body of data as IDataThMode[]) {
                // Entry trễ của race đã kết thúc: áp vào sẽ xoá board của race hiện tại
                if (body.raceId < this.#raceId) {
                    continue;
                }
                this.updateNewRace(body.raceId);
                updated = this.updateNewData(body) || updated;
            }
            if (updated) {
                this._onNewDataUpdated?.();
            }
        } catch (e) {
            this.#logger.error(e);
        }
    }

    exportData(): Array<IHeroInfo[]> {
        const result: Array<IHeroInfo[]> = [];
        for (const [_, leaderBoard] of this.#pools) {
            result.push(leaderBoard.values());
        }
        return result;
    }

    private updateNewRace(raceId: number) {
        try {
            if (this.#raceId !== raceId) {
                //this.#logger.info(`NEW Race id: ${raceId}`);
                this.#pools.forEach(leaderBoard => leaderBoard.clear());
                this._realtimeIndex.clearAll();
                this.#raceId = raceId;
            }
        } catch (e) {
            this.#logger.error('Error when fetchNewRace');
            this.#logger.error(e);
        }
    }

    private updateNewData(data: IDataThMode) {
        const thCurRaceValue = this.#raceId;
        try {
            const hero = parseStreamValue(data);
            this.#pools.get(hero.heroRarity)!.set(hero.uniqueKey, hero);
            this._realtimeIndex.update(hero);
            return true;
        } catch (err) {
            this.#logger.error(`Error when updateNewData ${thCurRaceValue}`);
            this.#logger.error(err);
            return false;
        }
    }
}

function leaderBoardDescSort(a: IHeroInfo, b: IHeroInfo): number {
    return b.score - a.score;
}


function parseStreamValue(data: IDataThMode): IHeroInfo {

    const heroId = data.heroId;
    const userName = data.userName;
    const raceId = data.raceId;

    const network = THUtils.mapNetwork(data.network);
    const heroType = THUtils.mapHero(data.heroType);
    const heroRarity = THUtils.mapRarity(data.poolIndex);
    const heroUniqueKey = `${heroId}_${network}`;

    const score = THUtils.getScore(data.stakeBcoin, heroRarity, heroType, data.ticketCount);
    const bcoinFormatted = Math.round(data.stakeBcoin).toString();
    const senFormatted = Math.round(data.stakeSen).toString();

    return {
        raceId: raceId,
        uid: data.uid,
        userName: userName ? removeNameSuffix(userName) : 'unknown',
        heroId: heroId,
        heroType: heroType,
        heroRarity: heroRarity,
        network: network,
        uniqueKey: heroUniqueKey,

        stakeBcoin: data.stakeBcoin,
        stakeSen: data.stakeSen,
        stakeBcoinFormatted: bcoinFormatted,
        stakeSenFormatted: senFormatted,
        ticketCount: data.ticketCount,
        poolIndex: data.poolIndex,
        score: score,
    };
}
