// Mirrors the ap-deposit-bridge /monitor JSON. Every wei value is a decimal string (never a JS number).
export type Chain = "BSC" | "POLYGON";
export type TokenSym = "BCOIN" | "SEN";
export type LifecycleStatus = "signed" | "executed" | "expired";

export interface TokenCell {
    symbol: TokenSym;
    token: string;
    liquidity: string;
    totalDeposited: string;
    totalWithdrawn: string;
    collectedFees: string;
    sweptFees: string;
    totalFunded: string;
    solvency: {expected: string; actual: string; ok: boolean};
}

export interface ChainAggregate {
    chain: Chain;
    chainId: number;
    bridgeAddress: string;
    depositEnabled: boolean;
    withdrawEnabled: boolean;
    feePercent: string;
    tokens: TokenCell[];
}

export interface CrossChainCell {
    symbol: TokenSym;
    withdrawChain: Chain;
    depositChain: Chain;
    totalWithdrawn: string;
    oppositeDeposited: string;
    ok: boolean;              // invariant: withdrawn ≤ oppositeDeposited
    outstanding: string;      // debt still owed on withdrawChain = oppositeDeposited − withdrawn (gross)
    requiredNet: string;      // tokens needed to service it after fee
    liquidity: string;        // withdrawChain's balance for this token
    liquidityOk: boolean;     // liquidity ≥ requiredNet
}

export interface AggregateResponse {
    chains: ChainAggregate[];
    crossChain: CrossChainCell[];
    fetchedAt: number; // epoch ms of the on-chain snapshot
    cached: boolean;
}

export interface HealthCell {
    chain: Chain;
    cursor: number;
    head: number;
    confirmedHead: number;
    lag: number;
}

export interface HealthResponse {
    cells: HealthCell[];
    fetchedAt: number;
    cached: boolean;
}

export interface GapRow {
    id: number;
    chain: Chain;
    from_block: number;
    to_block: number;
    fromTime: number | null; // unix seconds; null if the block-timestamp read failed
    toTime: number | null;
}

export interface WalletRow {
    chain: Chain;
    token: string;
    symbol: TokenSym;
    wallet: string;
    deposited: string;
    withdrawn: string;
    updated_block: number;
    updated_at: string;
}

export interface LifecycleRow {
    id: number;
    chain: Chain;
    token: string;
    symbol: TokenSym;
    wallet: string;
    other_deposited: string;
    deadline: number;
    status: LifecycleStatus;
    tx_block: number | null;
    signed_at: string;
    resolved_at: string | null;
}

export interface AnomalyRow {
    id: number;
    kind: string;
    chain: Chain | null;
    token: string | null;
    wallet: string | null;
    detail: unknown;
    created_at: string;
}

export type LedgerKind = "deposit" | "withdraw";

// One itemized event in a wallet's timeline (§18). Wei stays a string; net is null for deposits.
export interface LedgerRow {
    chain: Chain;
    token: string;
    symbol: TokenSym;
    wallet: string;
    kind: LedgerKind;
    amount: string;
    net: string | null;
    cumulative: string;
    block: number;
    tx_hash: string;
    log_index: number;
    ts: number | null; // block unix seconds
}

// One page of the global transaction feed (/monitor/transactions), newest first.
export interface TransactionsResponse {
    rows: LedgerRow[];
    total: number;
    page: number;
    pageSize: number;
}

export interface BackfillResult {
    walletsScanned: number;
    rowsUpserted: number;
    ledgerTxProcessed: number;
    ledgerTxSkipped: number;
    ledgerEventsInserted: number;
    ledgerTxFailed: number;
    gapFilled: number | null;
}

export interface BackfillRequest {
    chain: Chain;
    gapId?: number;
    csv: string; // raw bscscan Transactions CSV export text
}

export interface AnomalyRecheckResult {
    id: number;
    resolved: boolean;
    detail: Record<string, string>;
}

export interface GapSweepResult {
    gapId: number;
    chain: Chain;
    fromBlock: number;
    toBlock: number;
    deposits: number;
    withdraws: number;
}
