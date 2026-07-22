import {Network, PerTxStatusPreview} from "../consts/Consts";

export interface IPreviewItem {
    tx: string;
    network: Network;
    wallet: string | null;
    heroIds: number[];
    rockAmount: number;
    status: PerTxStatusPreview;
    message?: string;
    currentRock?: number;
}

export interface IPreviewSummary {
    totalRock: number;
}

export interface IPreviewBody {
    expiresAt: number;
    input: {
        tx: string;
        network: Network;
    };
    summary: IPreviewSummary;
    items: IPreviewItem[];
}

export default interface IPreviewStore {
    /**
     * Read the cached preview for (network, tx). Used to skip the slow upstream blockchain
     * call on repeat preview clicks.
     */
    get(tx: string, network: Network): Promise<IPreviewBody | null>;

    /**
     * Save (overwrite) the preview at the natural key (network, tx).
     */
    save(body: IPreviewBody): Promise<void>;

    /**
     * Atomic GETDEL — the same preview cannot be confirmed twice.
     */
    consume(tx: string, network: Network): Promise<IPreviewBody | null>;
}
