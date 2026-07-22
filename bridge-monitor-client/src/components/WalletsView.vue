<script setup lang="ts">
import {computed, onMounted, ref} from "vue";
import {api} from "../api";
import {txUrl} from "../explorers";
import {formatWei, fmtTime, fmtUnix, shortAddr} from "../format";
import {useAsync} from "../useAsync";
import {usePoll, POLL_MS} from "../usePoll";
import CopyBtn from "./CopyBtn.vue";
import ChainBadge from "./ChainBadge.vue";
import TokenIcon from "./TokenIcon.vue";
import type {Chain, LedgerKind, LedgerRow, TokenSym, WalletRow} from "../types";

const chain = ref<"" | Chain>("");
const token = ref<"" | TokenSym>("");
const lookup = ref<string>("");
// The wallet the currently-shown ledger belongs to (so the timeline header is stable while re-typing).
const ledgerWallet = ref<string>("");

// Fetches are unfiltered (a wallet lookup returns both chains/tokens); the chain/token dropdowns filter the
// rows client-side below, so they take effect instantly and work even when a wallet is looked up.
const counters = useAsync(() =>
    lookup.value.trim() ? api.wallet(lookup.value.trim()) : api.wallets(),
);
const ledger = useAsync(() => api.walletLedger(ledgerWallet.value));
// Loaded once for a chain -> chainId map, so each ledger row can link its tx to the right explorer.
const agg = useAsync(() => api.aggregate());

const chainId = computed(() => {
    const m = new Map<Chain, number>();
    for (const c of agg.data.value?.chains ?? []) m.set(c.chain, c.chainId);
    return m;
});

const matches = (rowChain: Chain, rowSymbol: TokenSym): boolean =>
    (!chain.value || rowChain === chain.value) && (!token.value || rowSymbol === token.value);

const shownCounters = computed<WalletRow[]>(() =>
    (counters.data.value ?? []).filter((w) => matches(w.chain, w.symbol)));
const shownLedger = computed<LedgerRow[]>(() =>
    (ledger.data.value ?? []).filter((e) => matches(e.chain, e.symbol)));

function ledgerTxUrl(row: LedgerRow): string {
    const id = chainId.value.get(row.chain);
    return id ? txUrl(id, row.tx_hash) : "";
}

async function run(): Promise<void> {
    const wallet = lookup.value.trim();
    ledgerWallet.value = wallet;
    if (wallet) {
        await Promise.all([counters.run(), ledger.run()]);
    } else {
        await counters.run();
    }
}

// Click a wallet in the list → drill straight into that wallet's timeline (no copying the ellipsized address).
function selectWallet(addr: string): void {
    lookup.value = addr;
    run();
}

interface WithdrawableRow {
    symbol: TokenSym;
    withdrawChain: Chain;
    depositChain: Chain;
    deposited: string;  // on the OPPOSITE (source) chain
    withdrawn: string;  // already withdrawn on withdrawChain
    withdrawable: string;
}

// The number the user actually wants: for the looked-up wallet, how much it can still withdraw ON each chain.
// The bridge is directional, so withdrawable on chain C = deposited on the OPPOSITE chain − already-withdrawn on
// C (clamped at 0). The raw deposited/withdrawn rows hide this because they pair same-chain figures.
const ZERO = BigInt(0);
const withdrawable = computed<WithdrawableRow[]>(() => {
    const w = ledgerWallet.value.toLowerCase();
    if (!w) return [];
    const rows = (counters.data.value ?? []).filter((r) => r.wallet.toLowerCase() === w);
    const cell = new Map<string, {deposited: bigint; withdrawn: bigint}>();
    for (const r of rows) cell.set(`${r.chain}:${r.symbol}`, {deposited: BigInt(r.deposited), withdrawn: BigInt(r.withdrawn)});

    const chains: Chain[] = ["BSC", "POLYGON"];
    const symbols: TokenSym[] = ["BCOIN", "SEN"];
    const out: WithdrawableRow[] = [];
    for (const symbol of symbols) {
        for (const withdrawChain of chains) {
            const depositChain: Chain = withdrawChain === "BSC" ? "POLYGON" : "BSC";
            const dep = cell.get(`${depositChain}:${symbol}`)?.deposited ?? ZERO;
            const wd = cell.get(`${withdrawChain}:${symbol}`)?.withdrawn ?? ZERO;
            if (dep === ZERO && wd === ZERO) continue; // no activity for this direction — skip
            out.push({
                symbol, withdrawChain, depositChain,
                deposited: dep.toString(), withdrawn: wd.toString(),
                withdrawable: (dep > wd ? dep - wd : ZERO).toString(),
            });
        }
    }
    return out;
});

// Withdraw is MAX (pulls the whole available balance), so the withdrawn watermark always lands exactly on a
// deposit boundary — a deposit is either fully withdrawn or not yet, never partial.
type SettleStatus = "settled" | "outstanding";

interface SettleDeposit {
    ts: number | null;
    amount: string;
    cumulative: string;
    status: SettleStatus;
    widthPct: number;     // segment width on the bar = amount / total-deposited
    tx_hash: string;
}

interface SettleEvent {
    ts: number | null;
    kind: LedgerKind;
    chain: Chain;
    amount: string;
    cumulative: string;
    tx_hash: string;
    status: SettleStatus | null; // only for deposit events
}

interface DirectionSettle {
    symbol: TokenSym;
    depositChain: Chain;  // source
    withdrawChain: Chain; // destination
    deposited: string;    // D — total deposited on the source chain
    withdrawn: string;    // W — total withdrawn on the destination chain (the settlement watermark)
    outstanding: string;  // max(0, D − W)
    pct: number;          // W / D, clamped to 100
    overWithdrawn: boolean;
    deposits: SettleDeposit[];
    events: SettleEvent[];
}

function cumCmp(a: string, b: string): number {
    const x = BigInt(a), y = BigInt(b);
    return x < y ? -1 : x > y ? 1 : 0;
}

function tsCmp(a: number | null, b: number | null): number {
    if (a === null && b === null) return 0;
    if (a === null) return 1; // unresolved timestamps sort last
    if (b === null) return -1;
    return a - b;
}

// Settlement per direction (§1 directional model): each BSC deposit is "tất toán" (settled) once the POLYGON
// withdrawn watermark reaches its cumulative point, and vice versa. Totals D/W come from the authoritative
// counters; the per-deposit breakdown + timeline come from the ledger's `cumulative`. This is what tells the
// operator, at a glance, which deposits are still outstanding — impossible to see from a flat time list.
const settlements = computed<DirectionSettle[]>(() => {
    const w = ledgerWallet.value.toLowerCase();
    if (!w) return [];
    const cell = new Map<string, {deposited: bigint; withdrawn: bigint}>();
    for (const r of (counters.data.value ?? []).filter((x) => x.wallet.toLowerCase() === w)) {
        cell.set(`${r.chain}:${r.symbol}`, {deposited: BigInt(r.deposited), withdrawn: BigInt(r.withdrawn)});
    }
    const lRows = ledger.data.value ?? [];

    const symbols: TokenSym[] = ["BCOIN", "SEN"];
    const dirs: {deposit: Chain; withdraw: Chain}[] = [
        {deposit: "BSC", withdraw: "POLYGON"},
        {deposit: "POLYGON", withdraw: "BSC"},
    ];
    const out: DirectionSettle[] = [];
    for (const symbol of symbols) {
        for (const dir of dirs) {
            const D = cell.get(`${dir.deposit}:${symbol}`)?.deposited ?? ZERO;
            const W = cell.get(`${dir.withdraw}:${symbol}`)?.withdrawn ?? ZERO;
            if (D === ZERO && W === ZERO) continue;

            const src = lRows
                .filter((r) => r.symbol === symbol && r.kind === "deposit" && r.chain === dir.deposit)
                .slice()
                .sort((a, b) => cumCmp(a.cumulative, b.cumulative));
            const deposits: SettleDeposit[] = src.map((dep) => {
                const C = BigInt(dep.cumulative);
                const A = BigInt(dep.amount);
                const status: SettleStatus = C <= W ? "settled" : "outstanding";
                return {
                    ts: dep.ts, amount: dep.amount, cumulative: dep.cumulative, status,
                    widthPct: D > ZERO ? Number((A * BigInt(10000)) / D) / 100 : 0,
                    tx_hash: dep.tx_hash,
                };
            });

            const dst = lRows.filter((r) => r.symbol === symbol && r.kind === "withdraw" && r.chain === dir.withdraw);
            const events: SettleEvent[] = [
                ...deposits.map((d) => ({
                    ts: d.ts, kind: "deposit" as LedgerKind, chain: dir.deposit,
                    amount: d.amount, cumulative: d.cumulative, tx_hash: d.tx_hash, status: d.status,
                })),
                ...dst.map((r) => ({
                    ts: r.ts, kind: "withdraw" as LedgerKind, chain: dir.withdraw,
                    amount: r.amount, cumulative: r.cumulative, tx_hash: r.tx_hash, status: null,
                })),
            ].sort((a, b) => tsCmp(a.ts, b.ts) || cumCmp(a.cumulative, b.cumulative));

            out.push({
                symbol, depositChain: dir.deposit, withdrawChain: dir.withdraw,
                deposited: D.toString(), withdrawn: W.toString(),
                outstanding: (D > W ? D - W : ZERO).toString(),
                pct: D > ZERO ? Math.min(100, Number((W * BigInt(10000)) / D) / 100) : (W > ZERO ? 100 : 0),
                overWithdrawn: W > D, deposits, events,
            });
        }
    }
    return out;
});

function settleLabel(s: SettleStatus | null): string {
    return s === "settled" ? "Đã Withdraw" : s === "outstanding" ? "Chưa Withdraw" : "";
}
function settleBadge(s: SettleStatus | null): string {
    return s === "settled" ? "ok" : "warn";
}
function eventTxUrl(e: SettleEvent): string {
    const id = chainId.value.get(e.chain);
    return id ? txUrl(id, e.tx_hash) : "";
}

onMounted(() => {
    agg.run();
    run();
});

// Poll only what's already committed — never fetch a half-typed address from the input box. When a wallet is
// being viewed (input still equals it) refresh its counters + timeline; when the box is empty refresh the list;
// while mid-typing a new address, skip.
usePoll(() => {
    const typed = lookup.value.trim();
    if (ledgerWallet.value && typed === ledgerWallet.value) {
        counters.run();
        ledger.run();
    } else if (!typed) {
        counters.run();
    }
}, POLL_MS);
</script>

<template>
    <div class="toolbar">
        <select v-model="chain">
            <option value="">Tất cả chain</option>
            <option value="BSC">BSC</option>
            <option value="POLYGON">POLYGON</option>
        </select>
        <select v-model="token">
            <option value="">Tất cả token</option>
            <option value="BCOIN">BCOIN</option>
            <option value="SEN">SEN</option>
        </select>
        <input type="text" v-model="lookup" placeholder="Tìm Wallet 0x…" style="min-width: 320px" @keyup.enter="run"/>
        <button class="btn" :disabled="counters.loading.value" @click="run">{{ counters.loading.value ? "Đang tải…" : "Tìm Wallet" }}</button>
        <span class="muted" style="font-size: 12px">Chain/token lọc ngay trên cả 2 bảng.</span>
    </div>

    <p v-if="counters.error.value" class="error">{{ counters.error.value }}</p>

    <template v-if="counters.data.value">
        <p v-if="!shownCounters.length" class="empty">Không có dữ liệu Wallet khớp bộ lọc.</p>
        <div v-else class="card table-wrap">
            <table>
                <thead>
                <tr>
                    <th>Wallet</th>
                    <th>Chain</th>
                    <th>Token</th>
                    <th class="num">Đã Deposit</th>
                    <th class="num">Đã Withdraw</th>
                    <th class="num">Block</th>
                    <th>Cập nhật</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="(w, i) in shownCounters" :key="i">
                    <td class="mono">
                        <button class="link-wallet" :title="`Xem dòng thời gian ${w.wallet}`" @click="selectWallet(w.wallet)">
                            {{ shortAddr(w.wallet) }}
                        </button>
                        <CopyBtn :value="w.wallet"/>
                    </td>
                    <td><ChainBadge :chain="w.chain"/></td>
                    <td><TokenIcon :symbol="w.symbol"/></td>
                    <td class="num">{{ formatWei(w.deposited) }}</td>
                    <td class="num">{{ formatWei(w.withdrawn) }}</td>
                    <td class="num">{{ w.updated_block }}</td>
                    <td class="muted">{{ fmtTime(w.updated_at) }}</td>
                </tr>
                </tbody>
            </table>
        </div>
    </template>

    <!-- Directional withdrawable — the actionable view: how much this wallet can still pull out ON each chain. -->
    <template v-if="ledgerWallet && withdrawable.length">
        <h3 class="section">Có thể Withdraw — <span :title="ledgerWallet">{{ shortAddr(ledgerWallet) }}</span><CopyBtn :value="ledgerWallet"/></h3>
        <div class="card table-wrap">
            <table>
                <thead>
                <tr>
                    <th>Token</th>
                    <th>Withdraw trên</th>
                    <th class="num">Đã Deposit (chain nguồn)</th>
                    <th class="num">Đã Withdraw (chain này)</th>
                    <th class="num">Còn Withdraw được</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="(r, i) in withdrawable" :key="i">
                    <td><TokenIcon :symbol="r.symbol"/></td>
                    <td><ChainBadge :chain="r.withdrawChain"/></td>
                    <td class="num muted">{{ formatWei(r.deposited) }} <ChainBadge :chain="r.depositChain"/></td>
                    <td class="num muted">{{ formatWei(r.withdrawn) }}</td>
                    <td class="num" :class="r.withdrawable !== '0' ? 'kind-deposit' : 'muted'">
                        <strong>{{ formatWei(r.withdrawable) }}</strong>
                    </td>
                </tr>
                </tbody>
            </table>
        </div>
        <p class="msg">
            Bridge có hướng: Deposit BSC để Withdraw POLYGON, Deposit POLYGON để Withdraw BSC. "Còn Withdraw được"
            trên một chain = đã Deposit ở chain đối diện - đã Withdraw ở chain đó (theo dữ liệu đã index).
        </p>
    </template>

    <!-- Settlement per direction — progress bar (glance) + detail table (which deposits are settled). -->
    <template v-if="ledgerWallet && settlements.length">
        <h3 class="section">Tất toán theo hướng — <span :title="ledgerWallet">{{ shortAddr(ledgerWallet) }}</span><CopyBtn :value="ledgerWallet"/></h3>
        <div v-for="(s, si) in settlements" :key="si" class="card settle">
            <div class="settle-head">
                <span><ChainBadge :chain="s.depositChain"/> -&gt; <ChainBadge :chain="s.withdrawChain"/></span>
                <TokenIcon :symbol="s.symbol"/>
                <span class="muted">
                    Deposit {{ formatWei(s.deposited) }} · đã Withdraw {{ formatWei(s.withdrawn) }} ({{ s.pct }}%) ·
                    <span :class="s.outstanding !== '0' ? 'warn' : 'ok'">chưa Withdraw {{ formatWei(s.outstanding) }}</span>
                </span>
                <span v-if="s.overWithdrawn" class="badge bad" title="Đã Withdraw vượt đã Deposit — xem tab Bất thường">Withdraw vượt Deposit</span>
            </div>

            <div v-if="s.deposits.length" class="settle-bar">
                <div
                    v-for="(d, di) in s.deposits" :key="di"
                    class="seg" :class="`seg-${d.status}`"
                    :style="{width: d.widthPct + '%'}"
                    :title="`Deposit ${formatWei(d.amount)} — ${settleLabel(d.status)}`"
                ></div>
            </div>

            <div class="table-wrap">
                <table>
                    <thead>
                    <tr>
                        <th>Thời gian</th>
                        <th>Loại</th>
                        <th class="num">Số</th>
                        <th class="num">Luỹ kế</th>
                        <th>Trạng thái</th>
                        <th>Tx</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr v-for="(e, ei) in s.events" :key="ei">
                        <td class="muted">{{ e.ts ? fmtUnix(e.ts) : "-" }}</td>
                        <td :class="e.kind === 'deposit' ? 'kind-deposit' : 'kind-withdraw'">
                            {{ e.kind === "deposit" ? "Deposit" : "Withdraw" }} <ChainBadge :chain="e.chain"/>
                        </td>
                        <td class="num">{{ formatWei(e.amount) }}</td>
                        <td class="num muted">{{ formatWei(e.cumulative) }}</td>
                        <td>
                            <span v-if="e.kind === 'withdraw'" class="muted">tất toán tới {{ formatWei(e.cumulative) }}</span>
                            <span v-else class="badge" :class="settleBadge(e.status)">{{ settleLabel(e.status) }}</span>
                        </td>
                        <td class="mono">
                            <a v-if="eventTxUrl(e)" :href="eventTxUrl(e)" target="_blank" rel="noreferrer" :title="e.tx_hash">{{ shortAddr(e.tx_hash) }}</a>
                            <span v-else :title="e.tx_hash">{{ shortAddr(e.tx_hash) }}</span>
                            <CopyBtn :value="e.tx_hash"/>
                        </td>
                    </tr>
                    </tbody>
                </table>
            </div>
        </div>
        <p class="msg">
            Thanh: phần xanh = đã Withdraw, phần xám = chưa Withdraw; mỗi ô là một lệnh Deposit. Bridge có hướng nên
            lệnh Withdraw nằm ở chain đối diện lệnh Deposit (theo dữ liệu đã index).
        </p>
    </template>

    <!-- Itemized timeline (§18) — only when a specific wallet was looked up. -->
    <template v-if="ledgerWallet">
        <h3 class="section">Dòng thời gian Deposit/Withdraw — <span :title="ledgerWallet">{{ shortAddr(ledgerWallet) }}</span><CopyBtn :value="ledgerWallet"/></h3>
        <p class="muted" style="margin: -4px 0 10px; font-size: 13px">
            Sắp xếp theo thời gian block on-chain (gộp cả 2 network): CŨ NHẤT trên cùng -> MỚI NHẤT dưới cùng.
            Dòng không có thời gian (chưa đọc được block-time) xếp cuối.
        </p>
        <p v-if="ledger.error.value" class="error">{{ ledger.error.value }}</p>
        <p v-else-if="ledger.loading.value" class="muted">Đang tải dòng thời gian…</p>
        <p v-else-if="ledger.data.value && !shownLedger.length" class="empty">Không có bản ghi khớp bộ lọc cho Wallet này (có thể cần bù CSV lịch sử ở tab Khoảng trống).</p>
        <div v-else-if="ledger.data.value" class="card table-wrap">
            <table>
                <thead>
                <tr>
                    <th>Thời gian (cũ -&gt; mới)</th>
                    <th>Chain</th>
                    <th>Loại</th>
                    <th>Token</th>
                    <th class="num">Amount</th>
                    <th class="num">Net</th>
                    <th class="num">Luỹ kế</th>
                    <th>Tx</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="(e, i) in shownLedger" :key="i">
                    <td class="muted">{{ e.ts ? fmtUnix(e.ts) : "-" }}</td>
                    <td><ChainBadge :chain="e.chain"/></td>
                    <td :class="e.kind === 'deposit' ? 'kind-deposit' : 'kind-withdraw'">{{ e.kind === "deposit" ? "Deposit" : "Withdraw" }}</td>
                    <td><TokenIcon :symbol="e.symbol"/></td>
                    <td class="num">{{ formatWei(e.amount) }}</td>
                    <td class="num">{{ e.net === null ? "-" : formatWei(e.net) }}</td>
                    <td class="num">{{ formatWei(e.cumulative) }}</td>
                    <td class="mono">
                        <a v-if="ledgerTxUrl(e)" :href="ledgerTxUrl(e)" target="_blank" rel="noreferrer" :title="e.tx_hash">{{ shortAddr(e.tx_hash) }}</a>
                        <span v-else :title="e.tx_hash">{{ shortAddr(e.tx_hash) }}</span>
                        <CopyBtn :value="e.tx_hash"/>
                    </td>
                </tr>
                </tbody>
            </table>
        </div>
    </template>
</template>
