<script setup lang="ts">
import {computed, ref, watch} from "vue";
import {formatEther} from "ethers";
import {nativeApi, type NativeDailyPoint, type NativeSummary} from "./api";
import type {DepositNativeInstance} from "./config";

const props = defineProps<{instance: DepositNativeInstance; summary: NativeSummary | null}>();

const points = ref<NativeDailyPoint[]>([]);
const err = ref("");

// Newest first: the operator opens this to see what happened yesterday, not in 2026-07.
const rows = computed(() => [...points.value].reverse());

watch(() => props.summary, async (s) => {
    if (!s) return;
    try {
        points.value = (await nativeApi.daily(props.instance.network)).points;
    } catch (e) {
        err.value = e instanceof Error ? e.message : String(e);
    }
}, {immediate: true});
</script>

<template>
    <div class="card">
        <h2>Thống kê deposit</h2>

        <template v-if="summary">
            <div class="muted fees">
                <div>Số user đã nạp: <span class="mono">{{ summary.included.userCount }}</span></div>
                <div>Tổng nạp: <span class="mono">{{ formatEther(summary.included.depositedWei) }} {{ instance.nativeSymbol }}</span></div>
                <div>Đã rút: <span class="mono">{{ formatEther(summary.included.withdrawnWei) }} {{ instance.nativeSymbol }}</span></div>
                <div>Đang chờ rút: <span class="mono">{{ formatEther(summary.included.pendingWei) }} {{ instance.nativeSymbol }}</span></div>
                <div>Còn tiêu được: <span class="mono">{{ formatEther(summary.included.spendableWei) }} {{ instance.nativeSymbol }}</span></div>
                <div>Đã tiêu trong game: <span class="mono">{{ formatEther(summary.included.spentInGameWei) }} {{ instance.nativeSymbol }}</span></div>
            </div>

            <p v-if="summary.excludedUids.length" class="muted note">
                Không tính {{ summary.excludedUids.length }} uid bị loại
                (<span class="mono">{{ summary.excludedUids.join(", ") }}</span>), tổng nạp của nhóm đó là
                <span class="mono">{{ formatEther(summary.excluded.depositedWei) }} {{ instance.nativeSymbol }}</span>.
                Số "rút an toàn" ở trên thì vẫn tính cả nhóm này, vì họ cũng nạp tiền thật vào contract.
            </p>

            <table v-if="rows.length">
                <thead>
                    <tr>
                        <th>Ngày</th>
                        <th class="num">Nạp</th>
                        <th class="num">Tiêu</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="p in rows" :key="p.date">
                        <td class="mono">
                            {{ p.date }}
                            <span v-if="p.spanDays > 1" class="badge muted" :title="`Gộp ${p.spanDays} ngày vì thiếu bản chốt sổ`">{{ p.spanDays }}d</span>
                            <span v-if="p.basisChanged" class="badge muted" title="Danh sách uid bị loại đã đổi giữa hai lần chốt sổ">basis</span>
                            <span v-if="p.partial" class="badge muted" title="Tính từ lúc service khởi động, không phải từ đầu ngày — số này thấp hơn thực tế">một phần</span>
                        </td>
                        <td class="num mono">{{ formatEther(p.depositedWei) }}</td>
                        <td class="num mono">{{ formatEther(p.spentWei) }}</td>
                    </tr>
                </tbody>
            </table>
            <p v-else class="muted note">
                Chưa có ngày nào để so sánh. Số theo ngày là hiệu giữa hai lần chốt sổ, nên dòng đầu
                tiên xuất hiện sau lần chốt thứ hai.
            </p>
        </template>

        <p v-else class="muted">Đăng nhập để xem.</p>
        <div v-if="err" class="error">{{ err }}</div>
    </div>
</template>

<style scoped>
.fees {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 10px;
}

.note {
    font-size: 13px;
    margin: 0 0 12px;
}
</style>
