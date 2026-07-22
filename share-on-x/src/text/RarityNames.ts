// rarity:int (PlayerData.rare 0..9) -> display name. Copied from client ShareService.
export const RARITY_NAMES = [
    "Common", "Rare", "Super Rare", "Epic", "Legend",
    "Super Legend", "Mega", "Super Mega", "Mystic", "Super Mystic",
];

export function rarityName(rarity: number): string {
    return RARITY_NAMES[rarity] ?? `Rarity ${rarity}`;
}
