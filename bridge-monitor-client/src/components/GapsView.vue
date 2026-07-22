<script setup lang="ts">
import {computed, onMounted, ref} from "vue";
import {api} from "../api";
import {exportUrl} from "../explorers";
import {fmtUnix} from "../format";
import {useAsync} from "../useAsync";
import {usePoll, POLL_MS} from "../usePoll";
import ChainBadge from "./ChainBadge.vue";
import type {Chain, GapRow} from "../types";

const gaps = useAsync(() => api.gaps());
const agg = useAsync(() => api.aggregate());

// chain -> {chainId, bridgeAddress} so each gap can link to the explorer Export page for its contract.
const meta = computed(() => {
    const m = new Map<Chain, {chainId: number; bridgeAddress: string}>();
    for (const c of agg.data.value?.chains ?? []) m.set(c.chain, {chainId: c.chainId, bridgeAddress: c.bridgeAddress});
    return m;
});

function exportLink(g: GapRow): string {
    const info = meta.value.get(g.chain);
    return info ? exportUrl(info.chainId, info.bridgeAddress) : "";
}

const busyId = ref<number | null>(null);
const msg = ref<string>("");

async function reload(): Promise<void> {
    await Promise.all([gaps.run(), agg.run()]);
}

async function onFile(g: GapRow, ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    msg.value = "";
    const csv = await file.text();
    busyId.value = g.id;
    try {
        const res = await api.backfill({chain: g.chain, gapId: g.id, csv});
        msg.value = `Khoảng #${g.id} đã bù: ${res.walletsScanned} Wallet, ${res.rowsUpserted} dòng tổng; `
            + `ledger +${res.ledgerEventsInserted} event (${res.ledgerTxProcessed} tx xử lý, ${res.ledgerTxSkipped} bỏ qua`
            + `${res.ledgerTxFailed ? `, ${res.ledgerTxFailed} lỗi` : ""}).`;
        await reload();
    } catch (e) {
        msg.value = `Khoảng #${g.id}: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
        busyId.value = null;
        input.value = "";
    }
}

// Auto-fill via server getLogs (production) — no CSV round-trip for small ranges.
async function sweep(g: GapRow): Promise<void> {
    msg.value = "";
    busyId.value = g.id;
    try {
        const r = await api.sweepGap(g.id);
        msg.value = `Khoảng #${g.id} đã tự quét: +${r.deposits} Deposit, +${r.withdraws} Withdraw.`;
        await reload();
    } catch (e) {
        msg.value = `Khoảng #${g.id}: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
        busyId.value = null;
    }
}

// Mark done without scanning — for a range known empty (solo test).
async function discard(g: GapRow): Promise<void> {
    msg.value = "";
    busyId.value = g.id;
    try {
        await api.discardGap(g.id);
        msg.value = `Khoảng #${g.id} đã bỏ qua.`;
        await reload();
    } catch (e) {
        msg.value = `Khoảng #${g.id}: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
        busyId.value = null;
    }
}

onMounted(reload);
// Poll, but never mid-mutation (backfill/sweep/discard) so a refresh can't fight an in-flight action.
usePoll(() => { if (busyId.value === null) reload(); }, POLL_MS);
</script>

<template>
    <div class="toolbar">
        <button class="btn" :disabled="gaps.loading.value" @click="reload">
            {{ gaps.loading.value ? "Đang tải…" : "Refresh" }}
        </button>
        <span class="muted">Mở trang Export của contract, chọn khoảng NGÀY phủ block bên dưới, tải CSV rồi upload.</span>
    </div>

    <p v-if="gaps.error.value" class="error">{{ gaps.error.value }}</p>
    <p v-if="msg" class="msg">{{ msg }}</p>

    <template v-if="gaps.data.value">
        <p v-if="!gaps.data.value.length" class="empty">Không có khoảng trống nào.</p>
        <div v-else class="card table-wrap">
            <table>
                <thead>
                <tr>
                    <th>ID</th>
                    <th>Chain</th>
                    <th class="num">Từ block</th>
                    <th>Ngày (từ block)</th>
                    <th class="num">Đến block</th>
                    <th>Ngày (đến block)</th>
                    <th>Trang Export</th>
                    <th>Bù bằng CSV</th>
                    <th>Tự quét / Bỏ qua</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="g in gaps.data.value" :key="g.id">
                    <td>{{ g.id }}</td>
                    <td><ChainBadge :chain="g.chain"/></td>
                    <td class="num">{{ g.from_block }}</td>
                    <td class="muted">{{ g.fromTime ? fmtUnix(g.fromTime) : "-" }}</td>
                    <td class="num">{{ g.to_block }}</td>
                    <td class="muted">{{ g.toTime ? fmtUnix(g.toTime) : "-" }}</td>
                    <td>
                        <a v-if="exportLink(g)" :href="exportLink(g)" target="_blank" rel="noreferrer">Mở Export</a>
                        <span v-else class="muted">—</span>
                    </td>
                    <td>
                        <label class="upload-label">
                            {{ busyId === g.id ? "Đang xử lý…" : "Upload CSV" }}
                            <input type="file" accept=".csv,text/csv" :disabled="busyId === g.id" @change="onFile(g, $event)"/>
                        </label>
                    </td>
                    <td class="gap-actions">
                        <button class="btn" :disabled="busyId === g.id" @click="sweep(g)">Tự quét</button>
                        <button class="btn" :disabled="busyId === g.id" @click="discard(g)">Bỏ qua</button>
                    </td>
                </tr>
                </tbody>
            </table>
        </div>
    </template>
</template>

<style scoped>
.gap-actions {
    display: flex;
    gap: 6px;
}
</style>
