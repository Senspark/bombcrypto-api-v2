import {HeroRarity, HeroType, IHeroInfo, Network} from "../leaderboard/LeaderBoardData";

export {Network, HeroRarity, HeroType};
export type {IHeroInfo};

export type RewardType = 'BCOIN' | 'SENSPARK';

export interface IActiveHero {
    bomberId: number;
    rarity: HeroRarity;
    stage: number;
    stakeBcoin: number;
    stakeSen: number;
    network: Network;
}

export interface IPendingReward {
    rewardType: RewardType;
    value: number;
    network: Network;
}

export interface IDailyEarning {
    date: string;    // yyyy-mm-dd
    network: Network;
    bcoin: number;
    sen: number;
    coin: number;
}

export interface ICurrentRace {
    raceId: number;
    heroes: IHeroInfo[];
}

export interface IWatchData {
    wallet: string;
    uid: number;
    userName: string;
    activeHeroes: IActiveHero[];
    pendingRewards: IPendingReward[];
    dailyEarnings: IDailyEarning[];
    currentRace: ICurrentRace;
}
