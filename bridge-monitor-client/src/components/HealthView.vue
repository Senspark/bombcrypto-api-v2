<script setup lang="ts">
import {onMounted} from "vue";
import {api} from "../api";
import {snapshotNote} from "../format";
import {useAsync} from "../useAsync";
import {usePoll, POLL_MS} from "../usePoll";
import ChainBadge from "./ChainBadge.vue";

const {data, loading, error, run} = useAsync((force = false) => api.health(force));
onMounted(() => run()); // cached by default; Refresh forces a chain re-read
// Poll: the sweep invalidates the health snapshot whenever the cursor advances, so this shows fresh lag.
usePoll(() => run(), POLL_MS);

// Lag lớn = tail còn xa head đã xác nhận — phần lịch sử nằm trong khoảng trống chờ bù dữ liệu.
function lagClass(lag: number): string {
    return lag > 5000 ? "bad" : lag > 500 ? "warn" : "ok";
}
</script>

<template>
    <div class="toolbar">
        <button class="btn" :disabled="loading" @click="run(true)">{{ loading ? "Đang tải…" : "Refresh" }}</button>
        <span class="muted">Đọc từ cache; bấm Refresh để đọc lại on-chain.</span>
        <span v-if="data" class="muted">· {{ snapshotNote(data.fetchedAt, data.cached) }}</span>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="data">
        <div class="card table-wrap">
            <table>
                <thead>
                <tr>
                    <th>Chain</th>
                    <th class="num">Cursor</th>
                    <th class="num">Head đã xác nhận</th>
                    <th class="num">Head mới nhất</th>
                    <th class="num">Độ trễ</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="h in data.cells" :key="h.chain">
                    <td><ChainBadge :chain="h.chain"/></td>
                    <td class="num">{{ h.cursor }}</td>
                    <td class="num">{{ h.confirmedHead }}</td>
                    <td class="num">{{ h.head }}</td>
                    <td class="num"><span class="badge" :class="lagClass(h.lag)">{{ h.lag }}</span></td>
                </tr>
                </tbody>
            </table>
        </div>
    </template>
</template>
