<script setup lang="ts">
import {computed, onMounted, ref} from "vue";
import {api} from "../api";
import {readProxyUrl} from "../explorers";
import {formatWei, fmtTime, shortAddr} from "../format";
import {useAsync} from "../useAsync";
import {usePoll, POLL_MS} from "../usePoll";
import CopyBtn from "./CopyBtn.vue";
import type {AnomalyRow, Chain} from "../types";

const anomalies = useAsync(() => api.anomalies(200));
const agg = useAsync(() => api.aggregate());

async function reload(): Promise<void> {
    await Promise.all([anomalies.run(), agg.run()]);
}
onMounted(reload);
// Poll, but not while a recheck is running.
usePoll(() => { if (busyId.value === null) reload(); }, POLL_MS);

const busyId = ref<number | null>(null);
const msg = ref<string>("");

// Ask the backend to re-verify this anomaly against current on-chain state. Resolved -> it drops off the list.
async function recheck(a: AnomalyRow): Promise<void> {
    msg.value = "";
    busyId.value = a.id;
    try {
        const r = await api.recheckAnomaly(a.id);
        msg.value = r.resolved
            ? `Bất thường #${a.id} đã hết theo số on-chain hiện tại — đánh dấu đã xử lý.`
            : `Bất thường #${a.id} VẪN CÒN theo số on-chain hiện tại.`;
        if (r.resolved) await reload();
    } catch (e) {
        msg.value = `Bất thường #${a.id}: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
        busyId.value = null;
    }
}

// chain -> {chainId, bridgeAddress, token address per symbol} — to build the explorer verify links.
const meta = computed(() => {
    const m = new Map<Chain, {chainId: number; bridgeAddress: string; tokens: Record<string, string>}>();
    for (const c of agg.data.value?.chains ?? []) {
        const tokens: Record<string, string> = {};
        for (const t of c.tokens) tokens[t.symbol] = t.token;
        m.set(c.chain, {chainId: c.chainId, bridgeAddress: c.bridgeAddress, tokens});
    }
    return m;
});

const KIND_LABEL: Record<string, string> = {
    CROSS_CHAIN_INSOLVENT: "Mất cân đối cross-chain",
    PER_USER_OVER_WITHDRAW: "Wallet Withdraw quá mức",
    CHECKSUM_MISMATCH: "Lệch checksum",
};

function kindLabel(kind: string): string {
    return KIND_LABEL[kind] ?? kind;
}

function opposite(chain: string): Chain {
    return chain === "BSC" ? "POLYGON" : "BSC";
}

// Turn the raw jsonb detail into a readable Vietnamese sentence with wei formatted as token amounts.
function describe(a: AnomalyRow): string {
    const d = (a.detail ?? {}) as Record<string, string>;
    const sym = d.symbol ?? "";
    switch (a.kind) {
        case "CROSS_CHAIN_INSOLVENT":
            return `Withdraw ${sym} trên ${d.withdrawChain} = ${formatWei(d.totalWithdrawn)} ${sym}, `
                + `vượt tổng Deposit trên ${d.depositChain} = ${formatWei(d.totalDepositedOpposite)} ${sym}`;
        case "PER_USER_OVER_WITHDRAW":
            return `Wallet Withdraw ${formatWei(d.withdrawn)} ${sym}, vượt số đã Deposit ở chain đối diện `
                + `= ${formatWei(d.oppositeDeposited)} ${sym}`;
        case "CHECKSUM_MISMATCH":
            return `Tổng deposited trong DB = ${formatWei(d.dbSumDeposited)} ${sym}, `
                + `vượt totalDeposited on-chain = ${formatWei(d.onchainTotalDeposited)} ${sym}`;
        default:
            return JSON.stringify(a.detail);
    }
}

interface VerifyItem {
    fn: string;    // the view function to call on the explorer
    chain: Chain;
    url: string;   // explorer Read-as-Proxy page of the contract to call it on
    inputs: string; // arguments to paste into the query
}

// The on-chain view calls that reproduce this anomaly's numbers, so the operator can query them on the
// explorer independently of our backend. (DB-side figures like the checksum's DB sum aren't on-chain.)
function verifyItems(a: AnomalyRow): VerifyItem[] {
    const d = (a.detail ?? {}) as Record<string, string>;
    const sym = d.symbol ?? "";
    const link = (chain: Chain, fn: string, inputs: string): VerifyItem | null => {
        const m = meta.value.get(chain);
        if (!m || !m.tokens[sym]) return null;
        return {fn, chain, url: readProxyUrl(m.chainId, m.bridgeAddress), inputs};
    };
    const tokenOf = (chain: Chain) => meta.value.get(chain)?.tokens[sym] ?? "";

    let items: (VerifyItem | null)[] = [];
    if (a.kind === "CROSS_CHAIN_INSOLVENT") {
        const wc = d.withdrawChain as Chain;
        const dc = d.depositChain as Chain;
        items = [
            link(wc, "totalWithdrawn", `token = ${tokenOf(wc)}`),
            link(dc, "totalDeposited", `token = ${tokenOf(dc)}`),
        ];
    } else if (a.kind === "PER_USER_OVER_WITHDRAW" && a.chain && a.wallet) {
        const wc = a.chain;
        const dc = opposite(a.chain);
        items = [
            link(wc, "withdrawn", `user = ${a.wallet}, token = ${tokenOf(wc)}`),
            link(dc, "deposited", `user = ${a.wallet}, token = ${tokenOf(dc)}`),
        ];
    } else if (a.kind === "CHECKSUM_MISMATCH" && a.chain) {
        items = [link(a.chain, "totalDeposited", `token = ${tokenOf(a.chain)}`)];
    }
    return items.filter((x): x is VerifyItem => x !== null);
}
</script>

<template>
    <div class="toolbar">
        <button class="btn" :disabled="anomalies.loading.value" @click="reload">
            {{ anomalies.loading.value ? "Đang tải…" : "Refresh" }}
        </button>
        <span class="muted">Chỉ cảnh báo. Bấm "Kiểm tra" để tự query số on-chain trên explorer.</span>
    </div>

    <p v-if="anomalies.error.value" class="error">{{ anomalies.error.value }}</p>
    <p v-if="msg" class="msg">{{ msg }}</p>

    <template v-if="anomalies.data.value">
        <p v-if="!anomalies.data.value.length" class="empty">Chưa ghi nhận bất thường.</p>
        <div v-else class="card table-wrap">
            <table>
                <thead>
                <tr>
                    <th>Thời gian</th>
                    <th>Loại</th>
                    <th>Wallet</th>
                    <th>Mô tả</th>
                    <th>Kiểm tra</th>
                    <th>Xử lý</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="a in anomalies.data.value" :key="a.id">
                    <td class="muted">{{ fmtTime(a.created_at) }}</td>
                    <td><span class="badge bad" :title="a.kind">{{ kindLabel(a.kind) }}</span></td>
                    <td class="mono">
                        <template v-if="a.wallet"><span :title="a.wallet">{{ shortAddr(a.wallet) }}</span><CopyBtn :value="a.wallet"/></template>
                        <template v-else>-</template>
                    </td>
                    <td>{{ describe(a) }}</td>
                    <td>
                        <div v-for="(v, i) in verifyItems(a)" :key="i" class="verify-item">
                            <a :href="v.url" target="_blank" rel="noreferrer">{{ v.fn }} @ {{ v.chain }}</a>
                            <span class="mono muted verify-inputs">{{ v.inputs }}</span>
                        </div>
                        <span v-if="!verifyItems(a).length" class="muted">—</span>
                    </td>
                    <td>
                        <button class="btn" :disabled="busyId === a.id" @click="recheck(a)">
                            {{ busyId === a.id ? "Đang kiểm…" : "Kiểm tra lại" }}
                        </button>
                    </td>
                </tr>
                </tbody>
            </table>
        </div>
    </template>
</template>

<style scoped>
.verify-item {
    margin-bottom: 6px;
}

.verify-inputs {
    display: block;
    font-size: 12px;
    word-break: break-all;
}
</style>
