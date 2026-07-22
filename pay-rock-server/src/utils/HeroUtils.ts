export interface IDecodedDetails {
    heroId: number;
    rarity: number;
    isHeroS: boolean;
}

export function decodeHeroDetails(_details: string): IDecodedDetails {
    const details = BigInt(_details);

    const n30Bits = (1n << 30n) - 1n;
    const n5Bits = (1n << 5n) - 1n;
    const id = details & n30Bits;
    const rarity = (details >> 40n) & n5Bits;
    const abilityS = (details >> 180n) & n5Bits;
    const isHeroS = abilityS > 0n;

    return {
        heroId: Number(id),
        rarity: Number(rarity),
        isHeroS,
    };
}
