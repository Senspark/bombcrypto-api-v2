export type Network = 'BSC' | 'POLYGON';

export type PerTxStatusPreview =
    | 'PAYABLE'
    | 'ALREADY_PAID'
    | 'INVALID_NOT_BURN'
    | 'INVALID_NO_HERO_DATA'
    | 'INVALID_ZERO_ROCK'
    | 'ERROR_BLOCKCHAIN_API';

export type PerTxStatusConfirm = 'PAID' | 'ALREADY_PAID' | 'ERROR_DB';

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

export interface IConfirmResult {
    processed: Array<{ tx: string; network: Network; rockAmount: number; status: 'PAID' }>;
    skipped: Array<{ tx: string; status: 'ALREADY_PAID' }>;
    failed: Array<{ tx: string; status: 'ERROR_DB'; message: string }>;
    summary: {
        wallet: string | null;
        totalRockCredited: number;
        rockBefore: number | null;
        rockAfter: number | null;
        paidCount: number;
        skippedCount: number;
        failedCount: number;
    };
}

export interface IApiError {
    error: string;
    [k: string]: any;
}
