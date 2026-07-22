// skin:int = PlayerType ordinal (BHero pool 1..66) -> display name. Copied from client.
export const SKIN_NAMES: Record<number, string> = {
    1: "BomberMan", 2: "Knight", 3: "Man", 4: "Vampire", 5: "Witch",
    6: "Doge", 7: "Pepe", 8: "Ninja", 9: "King", 10: "Pilot Rabbit",
    11: "Meo", 12: "Monkey", 13: "Pilot", 14: "Black Cat", 15: "Tiger",
    16: "Pug Dog", 17: "Sailor Moon", 18: "Pepe Clown", 19: "Frog Gentleman", 20: "Dragoon",
    21: "Ghost", 22: "Pumpkin", 23: "Werewolf", 24: "Football Frog", 25: "Football Knight",
    26: "Football Man", 27: "Football Vampire", 28: "Football Witch", 29: "Football Doge", 30: "Football Pepe",
    31: "Football Ninja",
    32: "Super Knight", 33: "Super Cowboy", 34: "Super Witch", 35: "Super Ninja", 36: "Super Poo",
    37: "Super GKu", 38: "Super Pinky Toon", 39: "Super Stickman", 40: "Super Monitor", 41: "Super Dragon",
    42: "Super Santa", 43: "Super Miner", 44: "Super Calico", 45: "Super Kuroneko", 46: "Super Golden Kat",
    47: "Super Mr Dear", 48: "Super T-Lion", 49: "Super Frog", 50: "Super Doge", 51: "Super King",
    52: "Super Cupid", 53: "Super B-Guy", 54: "Super Pinky Bear", 55: "Super Neko Chan", 56: "Super Hesman",
    57: "Chess Queen", 58: "Chess Pawn", 59: "Chess Rook", 60: "Chess Horse", 61: "Chess Bishop",
    62: "Irondeux", 63: "Omega", 64: "Saber", 65: "Demon Slayer", 66: "Koi Man",
};

export function skinName(skin: number): string {
    return SKIN_NAMES[skin] ?? `BHero #${skin}`;
}
