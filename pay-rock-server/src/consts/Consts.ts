export enum Network {
    BSC = 'BSC',
    POLYGON = 'POLYGON',
}

export const RedisKeys = {
    PAY_ROCK_PREVIEW: "PAY_ROCK:PREVIEW",
};

export type PerTxStatusPreview =
    | 'PAYABLE'
    | 'ALREADY_PAID'
    | 'INVALID_NOT_BURN'
    | 'INVALID_NO_HERO_DATA'
    | 'INVALID_ZERO_ROCK'
    | 'ERROR_BLOCKCHAIN_API';

export type PerTxStatusConfirm = 'PAID' | 'ALREADY_PAID' | 'ERROR_DB';
