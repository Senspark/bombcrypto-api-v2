import {rarityName} from "./RarityNames";
import {skinName} from "./SkinNames";

// heroes[i] = [heroId, rarity, skin] (positional).
export type HeroTuple = [number, number, number];

export interface ComposeInput {
    source: string; // "new_hero" | "summary" | "token_reward" | "collection"
    heroes: HeroTuple[];
    token?: string;
    amount?: number;
}

export interface ComposedTweet {
    text: string;
    title: string;       // placeholder copy — tune later (plan §10)
    description: string;
}

const PLATFORM_TAG = "#BombCrypto";
const SECONDARY_HASHTAGS = "#Play2Earn #TreasureHunt";
// X t.co shrinks every URL to 23 chars; reserve 23 + 1 space so text + url <= 280.
const TEXT_BUDGET = 280 - 23 - 1;
const CARD_TITLE = "Bombcrypto";

export default class TweetComposer {
    compose(input: ComposeInput): ComposedTweet {
        const body = this.composeBody(input);
        return {
            text: this.withHashtags(body),
            title: CARD_TITLE,
            description: body,
        };
    }

    private composeBody(input: ComposeInput): string {
        switch (input.source) {
            case "token_reward":
                return this.composeTokenBody(input.amount ?? 0);
            case "summary":
                return this.composeSummaryBody(input.heroes);
            case "collection":
                return `Check out my BHero collection on ${PLATFORM_TAG}`;
            case "new_hero":
            default:
                return this.composeNewHeroBody(input.heroes);
        }
    }

    private withHashtags(body: string): string {
        const full = `${body} ${SECONDARY_HASHTAGS}`;
        if (full.length <= TEXT_BUDGET) {
            return full;
        }
        if (body.length <= TEXT_BUDGET) {
            return body;
        }
        return `${body.slice(0, TEXT_BUDGET - 1)}…`;
    }

    private composeTokenBody(amount: number): string {
        // Always $BCOIN regardless of the real token (product decision).
        return `I just claimed ${this.formatAmount(amount)} $BCOIN on ${PLATFORM_TAG}`;
    }

    private composeNewHeroBody(heroes: HeroTuple[]): string {
        if (heroes.length === 0) {
            return `Just got a new BHero on ${PLATFORM_TAG}`;
        }
        const [, rarity, skin] = heroes[0];
        return `I just minted a ${rarityName(rarity)} ${skinName(skin)} on ${PLATFORM_TAG}`;
    }

    private composeSummaryBody(heroes: HeroTuple[]): string {
        const count = heroes.length;
        if (count === 0) {
            return `Just minted new BHeroes on ${PLATFORM_TAG}`;
        }
        const topRarity = Math.max(...heroes.map(([, rarity]) => rarity));
        const heroWord = count === 1 ? "BHero" : "BHeroes";
        return `I just minted ${count} ${heroWord} ${rarityName(topRarity)} on ${PLATFORM_TAG}`;
    }

    private formatAmount(amount: number): string {
        return amount.toLocaleString("en-US", {maximumFractionDigits: 4});
    }
}
