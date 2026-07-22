export enum Network {
    BSC,
    POLYGON
}

export enum HeroType {
    L,
    LP,
    S
}

export enum HeroRarity {
    Common,
    Rare,
    SuperRare,
    Epic,
    Legend,
    SuperLegend,
    Mega,
    SuperMega,
    Mystic,
    SuperMystic
}

export type HeroUniqueKey = string;

export interface IHeroInfo {
    raceId: number;
    userId: number;
    userName?: string; // Optional userName field added
    heroId: number;
    heroType: HeroType;
    heroRarity: HeroRarity;
    network: Network;
    uniqueKey: HeroUniqueKey;

    stakeBcoin: number;
    stakeSen: number;
    stakeBcoinFormatted: string;
    stakeSenFormatted: string;
    ticketCount: number;
    poolIndex: number;
    score: number;
}

export interface IRewardPoolInfo {
    poolId: number;
    bcoinRemaining: number;
    bcoinMax: number;
    senRemaining: number;
    senMax: number;
}

export interface IFetchedData {
    raceId: number,
    groupedData: Array<IHeroInfo[]>,
    rewardPools?: IRewardPoolInfo[]
}