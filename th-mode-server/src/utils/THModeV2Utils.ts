import {HeroRarity, HeroType, Network} from "../consts/Consts";

const HERO_TYPES_MAP = [
    HeroType.L,  // 0
    HeroType.LP, // 1
    HeroType.S,  // 2
];

const NETWORK_MAP = [
    Network.BSC,     // 0
    Network.POLYGON, // 1
];

const RARITY_MAP = [
    HeroRarity.Common,      // 0
    HeroRarity.Rare,        // 1
    HeroRarity.SuperRare,   // 2
    HeroRarity.Epic,        // 3
    HeroRarity.Legend,      // 4
    HeroRarity.SuperLegend, // 5
    HeroRarity.Mega,        // 6
    HeroRarity.SuperMega,   // 7
    HeroRarity.Mystic,      // 8
    HeroRarity.SuperMystic, // 9
];

const MIN_STAKE_BY_RARITY = [
    60,    // Common
    194,   // Rare
    388,   // SuperRare
    777,   // Epic
    1942,  // Legend
    3883,  // SuperLegend
    7766,  // Mega
    19415, // SuperMega
    38830, // Mystic
    77660, // SuperMystic
];

const MIN_STAKE_SCORE = 0.1;

function mapPoolIndexToLabel(poolIndex: number): HeroRarity {
    return RARITY_MAP[poolIndex];
}

function mapNetwork(value: number): Network {
    return NETWORK_MAP[value];
}

function mapHero(value: number): HeroType {
    return HERO_TYPES_MAP[value];
}

function mapRarity(value: number): HeroRarity {
    return RARITY_MAP[value];
}

function getScore(stake: number, rarity: HeroRarity, heroType: HeroType, ticket: number): number {
    let score = 0.0;
    const isHeroS = heroType === HeroType.S;
    if (stake > 0) {
        if (!isHeroS) {
            score = stake - getMinStake(rarity);
        } else {
            score = stake;
        }
    }
    if (score <= 0) {
        score = MIN_STAKE_SCORE;
    }
    return score * ticket;
}

function getMinStake(value: number): number {
    return MIN_STAKE_BY_RARITY[value];
}

const THUtils = {
    mapPoolIndexToLabel,
    mapNetwork,
    mapHero,
    mapRarity,
    getScore,
    getMinStake,
}
export default THUtils;

