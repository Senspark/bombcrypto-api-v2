import {Network} from "../consts/Consts";

export interface IExistingRockTx {
    status: string;
    rockAmount: number;
    heroIds: number[];
}

export default interface IPayRockRepository {
    /**
     * Returns null if no row exists for (tx, network).
     */
    findExistingRockTx(tx: string, network: Network): Promise<IExistingRockTx | null>;

    /**
     * Returns gen_id strings for the given bomber ids on a network. Missing ids
     * are simply absent from the response.
     */
    findHeroGenIds(heroIds: number[], network: Network): Promise<string[]>;

    /**
     * Map from rarity to [hero_s_rock, hero_l_rock]. Cached.
     */
    getBurnHeroConfig(): Promise<Map<number, [number, number]>>;

    /**
     * Calls sp_modify_rock_from_user_wallet. Throws on error.
     */
    creditRock(wallet: string, tx: string, heroIds: number[], rockAmount: number, network: Network): Promise<void>;

    /**
     * Current ROCK balance for the wallet, read from user_block_reward. Returns 0 if no row or unknown wallet.
     */
    getUserRockBalance(wallet: string): Promise<number>;
}
