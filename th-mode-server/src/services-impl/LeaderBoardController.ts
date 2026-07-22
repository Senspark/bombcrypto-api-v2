import {ILeaderBoardController, ILogger} from "../Services";
import THUtils from "../utils/THModeV2Utils";
import {HeroRarity, HeroUniqueKey, IHeroInfo, StreamKeys} from "../consts/Consts";
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

    #raceId: string | undefined;

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

        this._messageService.listen(StreamKeys.SV_TH_MODE_RACE, this.onThModeRaceUpdated.bind(this));
    }

    get currentRaceId() {
        if (!this.#raceId) {
            return 0;
        }
        return parseInt(this.#raceId) || 0;
    }


    async onThModeRaceUpdated(data: any) {
        try {
            const body: IDataThMode = data;
            this.#logger.assert(body, 'Invalid request body');

            this.updateNewRace(body.raceId);
            this.updateNewData(body);

            this._onNewDataUpdated?.();
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
            if (this.#raceId !== raceId.toString()) {
                //this.#logger.info(`NEW Race id: ${raceId}`);
                this.#pools.forEach(leaderBoard => leaderBoard.clear());
                this._realtimeIndex.clearAll();
                this.#raceId = raceId.toString();
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
