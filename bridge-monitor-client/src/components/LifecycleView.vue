<script setup lang="ts">
import {onMounted, ref} from "vue";
import {api} from "../api";
import {formatWei, fmtTime, fmtUnix, shortAddr} from "../format";
import {useAsync} from "../useAsync";
import {usePoll, POLL_MS} from "../usePoll";
import CopyBtn from "./CopyBtn.vue";
import ChainBadge from "./ChainBadge.vue";
import TokenIcon from "./TokenIcon.vue";
import type {LifecycleStatus} from "../types";

const status = ref<"" | LifecycleStatus>("");

const {data, loading, error, run} = useAsync(() => api.lifecycle(status.value || undefined, 200));
onMounted(run);
// Poll the lifecycle list (fresh from DB) with the current status filter applied.
usePoll(() => run(), POLL_MS);

function statusClass(s: LifecycleStatus): string {
    return s === "executed" ? "ok" : s === "expired" ? "muted" : "warn";
}

function statusLabel(s: LifecycleStatus): string {
    return s === "executed" ? "đã Withdraw" : s === "expired" ? "hết hạn" : "đã ký";
}
</script>

<template>
    <div class="toolbar">
        <select v-model="status">
            <option value="">Tất cả</option>
            <option value="signed">đã ký</option>
            <option value="executed">đã Withdraw</option>
            <option value="expired">hết hạn</option>
        </select>
        <button class="btn" :disabled="loading" @click="run">{{ loading ? "Đang tải…" : "Áp dụng" }}</button>
        <span class="muted">Các uỷ quyền Withdraw đã ký và cách chúng kết thúc.</span>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="data">
        <p v-if="!data.length" class="empty">Không có dữ liệu vòng đời.</p>
        <div v-else class="card table-wrap">
            <table>
                <thead>
                <tr>
                    <th>ID</th>
                    <th>Trạng thái</th>
                    <th>Chain</th>
                    <th>Token</th>
                    <th>Wallet</th>
                    <th class="num">Đã Deposit (đối diện)</th>
                    <th>Hạn chót</th>
                    <th>Ký lúc</th>
                    <th>Kết thúc lúc</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="l in data" :key="l.id">
                    <td>{{ l.id }}</td>
                    <td><span class="badge" :class="statusClass(l.status)">{{ statusLabel(l.status) }}</span></td>
                    <td><ChainBadge :chain="l.chain"/></td>
                    <td><TokenIcon :symbol="l.symbol"/></td>
                    <td class="mono"><span :title="l.wallet">{{ shortAddr(l.wallet) }}</span><CopyBtn :value="l.wallet"/></td>
                    <td class="num">{{ formatWei(l.other_deposited) }}</td>
                    <td class="muted">{{ fmtUnix(l.deadline) }}</td>
                    <td class="muted">{{ fmtTime(l.signed_at) }}</td>
                    <td class="muted">{{ fmtTime(l.resolved_at) }}</td>
                </tr>
                </tbody>
            </table>
        </div>
    </template>
</template>
