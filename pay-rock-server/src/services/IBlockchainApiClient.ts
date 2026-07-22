import {Network} from "../consts/Consts";

export interface IQueryRockBurnTxResponse {
    tx: string;
    wallet_address: string;
    hero_ids: number[];
}

export default interface IBlockchainApiClient {
    queryRockBurnTx(tx: string, network: Network): Promise<IQueryRockBurnTxResponse | null>;
}
