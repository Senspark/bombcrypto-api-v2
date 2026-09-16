import {Network} from "../consts/Consts";

export interface IQueryRockBurnTxResponse {
    tx: string;
    wallet_address: string;
    hero_ids: number[];
    /**
     * Raw on-chain hero details, one per entry of hero_ids, in the same order. Comes from the
     * CreateRockDetails event, so it is present even for a hero the game database never synced.
     * Undefined for burns older than that contract upgrade.
     */
    hero_details?: string[];
}

export default interface IBlockchainApiClient {
    queryRockBurnTx(tx: string, network: Network): Promise<IQueryRockBurnTxResponse | null>;
}
