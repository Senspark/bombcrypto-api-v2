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
    userName?: string;
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

export const StreamKeys = {
    SV_TH_MODE_RACE: "SV_TH_MODE_RACE",
}