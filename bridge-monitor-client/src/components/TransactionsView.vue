<script setup lang="ts">
import {computed, onMounted, ref} from "vue";
import {api} from "../api";
import {txUrl} from "../explorers";
import {formatWei, fmtUnix, shortAddr} from "../format";
import {useAsync} from "../useAsync";
import {usePoll, POLL_MS} from "../usePoll";
import CopyBtn from "./CopyBtn.vue";
import ChainBadge from "./ChainBadge.vue";
import TokenIcon from "./TokenIcon.vue";
import type {Chain, LedgerKind, LedgerRow, TokenSym} from "../types";

const chain = ref<"" | Chain>("");
const token = ref<"" | TokenSym>("");
const kind = ref<"" | LedgerKind>("");
const page = ref(1);
const pageSize = 50;

const {data, loading, error, run} = useAsync(() =>
    api.transactions(
        {chain: chain.value || undefined, token: token.value || undefined, kind: kind.value || undefined},
        page.value, pageSize,
    ),
);

// Loaded once for a chain -> chainId map so each row's tx links to the right explorer.
const agg = useAsync(() => api.aggregate());
const chainId = computed(() => {
    const m = new Map<Chain, number>();
    for (const c of agg.data.value?.chains ?? []) m.set(c.chain, c.chainId);
    return m;
});
function rowTxUrl(r: LedgerRow): string {
    const id = chainId.value.get(r.chain);
    return id ? txUrl(id, r.tx_hash) : "";
}

const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / pageSize)));

// Any filter change starts over at the newest page.
function applyFilters(): void {
    page.value = 1;
    run();
}
function goto(p: number): void {
    const next = Math.min(Math.max(1, p), totalPages.value);
    if (next === page.value) return;
    page.value = next;
    run();
}

onMounted(() => {
    agg.run();
    run();
});
// Poll only on the newest page — offset paging shifts rows as new txs arrive, so auto-refreshing a deeper page
// would move rows under the user. On page 1, new txs just appear at the top.
usePoll(() => { if (page.value === 1) run(); }, POLL_MS);
</script>

<template>
    <div class="toolbar">
        <select v-model="chain" @change="applyFilters">
            <option value="">Mọi Network</option>
            <option value="BSC">BSC</option>
            <option value="POLYGON">POLYGON</option>
        </select>
        <select v-model="token" @change="applyFilters">
            <option value="">Mọi token</option>
            <option value="BCOIN">BCOIN</option>
            <option value="SEN">SEN</option>
        </select>
        <select v-model="kind" @change="applyFilters">
            <option value="">Deposit + Withdraw</option>
            <option value="deposit">Deposit</option>
            <option value="withdraw">Withdraw</option>
        </select>
        <button class="btn" :disabled="loading" @click="run">{{ loading ? "Đang tải…" : "Refresh" }}</button>
        <span v-if="data" class="muted">· {{ data.total }} giao dịch</span>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="data">
        <div class="card table-wrap">
            <table>
                <thead>
                <tr>
                    <th>Thời gian</th>
                    <th>Chain</th>
                    <th>Loại</th>
                    <th>Token</th>
                    <th>Wallet</th>
                    <th class="num">Amount</th>
                    <th class="num">Net</th>
                    <th class="num">Luỹ kế</th>
                    <th>Tx</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="(e, i) in data.rows" :key="i">
                    <td class="muted">{{ e.ts ? fmtUnix(e.ts) : "-" }}</td>
                    <td><ChainBadge :chain="e.chain"/></td>
                    <td :class="e.kind === 'deposit' ? 'kind-deposit' : 'kind-withdraw'">{{ e.kind === "deposit" ? "Deposit" : "Withdraw" }}</td>
                    <td><TokenIcon :symbol="e.symbol"/></td>
                    <td class="mono"><span :title="e.wallet">{{ shortAddr(e.wallet) }}</span><CopyBtn :value="e.wallet"/></td>
                    <td class="num">{{ formatWei(e.amount) }}</td>
                    <td class="num">{{ e.net === null ? "-" : formatWei(e.net) }}</td>
                    <td class="num">{{ formatWei(e.cumulative) }}</td>
                    <td class="mono">
                        <a v-if="rowTxUrl(e)" :href="rowTxUrl(e)" target="_blank" rel="noreferrer" :title="e.tx_hash">{{ shortAddr(e.tx_hash) }}</a>
                        <span v-else :title="e.tx_hash">{{ shortAddr(e.tx_hash) }}</span>
                        <CopyBtn :value="e.tx_hash"/>
                    </td>
                </tr>
                <tr v-if="data.rows.length === 0">
                    <td colspan="9" class="muted">Không có giao dịch.</td>
                </tr>
                </tbody>
            </table>
        </div>

        <div class="toolbar">
            <button class="btn" :disabled="page <= 1 || loading" @click="goto(1)">« Đầu</button>
            <button class="btn" :disabled="page <= 1 || loading" @click="goto(page - 1)">‹ Trước</button>
            <span class="muted">Trang {{ data.page }} / {{ totalPages }}</span>
            <button class="btn" :disabled="page >= totalPages || loading" @click="goto(page + 1)">Sau ›</button>
            <button class="btn" :disabled="page >= totalPages || loading" @click="goto(totalPages)">Cuối »</button>
        </div>
    </template>
</template>
