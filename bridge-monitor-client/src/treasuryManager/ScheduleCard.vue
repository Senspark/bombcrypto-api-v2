<script setup lang="ts">
import {computed, ref, watch} from "vue";
import {CHAINS} from "../treasury/config";
import {
    api,
    type RunRecord,
    type ScheduleConfig,
    type ScheduleState,
    type SwapRoute,
    type TreasuryInstance,
    type TreasuryReading,
} from "./api";

const props = defineProps<{
    instance: TreasuryInstance;
    route: SwapRoute;
    entry: {config: ScheduleConfig; state: ScheduleState} | null;
}>();
const emit = defineEmits<{(e: "changed"): void}>();

const reading = ref<TreasuryReading | null>(null);
const intervalHours = ref("6");
const amountPerRun = ref("");
const capTotal = ref("");
const slippagePct = ref("1");
const busy = ref(false);
const err = ref("");
const runs = ref<RunRecord[] | null>(null);

const ready = computed(() => reading.value?.usdtConfigured && reading.value?.routerAllowed);
const state = computed(() => props.entry?.state ?? null);
const config = computed(() => props.entry?.config ?? null);
const running = computed(() => state.value?.status === "active");

async function loadReading() {
    reading.value = await api.reading(props.instance.id, props.route.id);
}

watch(() => [props.instance.id, props.route.id], () => void loadReading().catch(() => {}), {immediate: true});

// Prefill the form from the live schedule so "stop, tweak, start again" doesn't mean retyping.
watch(
    config,
    (c) => {
        if (!c) return;
        intervalHours.value = String(c.intervalMs / 3_600_000);
        amountPerRun.value = c.amountPerRun;
        capTotal.value = c.capTotal;
        slippagePct.value = String(c.slippageBps / 100);
    },
    {immediate: true},
);

function slippageBps(): number {
    const pct = parseFloat(slippagePct.value);
    if (isNaN(pct) || pct < 0) return 100;
    return Math.round(pct * 100);
}

function setMaxCap() {
    if (reading.value) capTotal.value = reading.value.fees;
}

async function act(fn: () => Promise<unknown>) {
    err.value = "";
    busy.value = true;
    try {
        await fn();
        await loadReading().catch(() => {});
        emit("changed");
    } catch (e) {
        err.value = e instanceof Error ? e.message : String(e);
    } finally {
        busy.value = false;
    }
}

function onStart() {
    const hours = parseFloat(intervalHours.value);
    if (isNaN(hours) || hours <= 0) {
        err.value = "Chu kỳ phải lớn hơn 0.";
        return;
    }
    void act(() =>
        api.createSchedule({
            instanceId: props.instance.id,
            routeId: props.route.id,
            intervalMs: Math.round(hours * 3_600_000),
            amountPerRun: amountPerRun.value.trim(),
            capTotal: capTotal.value.trim(),
            slippageBps: slippageBps(),
        }),
    );
}

function onStop() {
    if (!config.value) return;
    void act(() => api.stopSchedule(config.value!.id));
}

function onDelete() {
    if (!config.value) return;
    void act(() => api.deleteSchedule(config.value!.id));
}

async function toggleRuns() {
    if (runs.value) {
        runs.value = null;
        return;
    }
    if (!config.value) return;
    try {
        runs.value = (await api.runs(config.value.id)).runs;
    } catch (e) {
        err.value = e instanceof Error ? e.message : String(e);
    }
}

function when(ts: number | null): string {
    return ts ? new Date(ts).toLocaleString() : "-";
}
</script>

<template>
    <div class="card">
        <h2>{{ route.label }}</h2>

        <div v-if="reading" class="muted fees">
            Fee đang có: <span class="mono">{{ reading.fees }} {{ route.tokenInSymbol }}</span>
            &middot; USDT trong contract: <span class="mono">{{ reading.usdt }}</span>
        </div>

        <div v-if="reading && !ready" class="warn">
            Chưa cấu hình on-chain:
            <template v-if="!reading.usdtConfigured">usdtToken chưa set. </template>
            <template v-if="!reading.routerAllowed">router chưa whitelist. </template>
        </div>

        <div v-if="state" class="status" :class="state.status">
            <div>
                Trạng thái: <b>{{ state.status }}</b> &middot; đã swap
                <span class="mono">{{ state.swappedSoFar }}</span> / <span class="mono">{{ config?.capTotal }}</span>
                {{ route.tokenInSymbol }} &middot; {{ state.runCount }} lần
            </div>
            <div class="muted">
                Lần cuối: {{ when(state.lastRunAt) }} &middot;
                Kế tiếp: {{ running ? when(state.nextRunAt) : "-" }}
            </div>
            <div v-if="state.lastError" class="error">{{ state.lastError }}</div>
        </div>

        <div class="row">
            <label class="muted">Mỗi lần
                <input v-model="amountPerRun" type="text" inputmode="decimal" :disabled="busy || running || !ready"/>
            </label>
            <label class="muted">Tổng tối đa
                <input v-model="capTotal" type="text" inputmode="decimal" :disabled="busy || running || !ready"/>
            </label>
            <button class="btn max" :disabled="busy || running || !reading" @click="setMaxCap">MAX</button>
        </div>
        <div class="row">
            <label class="muted">Chu kỳ (giờ)
                <input v-model="intervalHours" type="text" inputmode="decimal" class="narrow" :disabled="busy || running"/>
            </label>
            <label class="muted">Slippage %
                <input v-model="slippagePct" type="text" inputmode="decimal" class="narrow" :disabled="busy || running"/>
            </label>
        </div>

        <div class="row actions">
            <button
                v-if="!running" class="btn"
                :disabled="busy || !ready || !amountPerRun.trim() || !capTotal.trim()"
                @click="onStart"
            >{{ busy ? "..." : "Bắt đầu tự động" }}</button>
            <button v-else class="btn" :disabled="busy" @click="onStop">{{ busy ? "..." : "Dừng" }}</button>
            <button v-if="config" class="btn ghost" :disabled="busy || running" @click="onDelete">Xóa</button>
            <button v-if="config" class="btn ghost" :disabled="busy" @click="toggleRuns">
                {{ runs ? "Ẩn lịch sử" : "Lịch sử" }}
            </button>
        </div>

        <table v-if="runs && runs.length" class="runs">
            <tbody>
                <tr v-for="(r, i) in runs" :key="i">
                    <td class="muted">{{ when(r.at) }}</td>
                    <td>
                        <a
                            v-if="r.txHash" :href="CHAINS[instance.chainId].explorerTx + r.txHash"
                            target="_blank" rel="noreferrer" class="mono"
                        >{{ r.amountIn }} -&gt; {{ r.expectedOut }}</a>
                        <span v-else class="error">{{ r.error }}</span>
                    </td>
                </tr>
            </tbody>
        </table>
        <p v-else-if="runs" class="muted">Chưa có lần chạy nào.</p>

        <div v-if="err" class="error">{{ err }}</div>
    </div>
</template>

<style scoped>
.fees { margin-bottom: 10px; }
.warn { color: var(--warn, #f5a623); margin-bottom: 12px; font-size: 13px; }
.row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.row input[type="text"] { width: 120px; margin-left: 6px; }
.row input.narrow { width: 70px; }
.actions { margin-top: 12px; }
.max { padding: 6px 10px; }
.btn.ghost { background: transparent; }
.status { margin-bottom: 12px; font-size: 13px; }
.status.active { color: var(--ok, #4caf50); }
.status.error { color: var(--err, #e05252); }
.runs { margin-top: 12px; font-size: 12px; width: 100%; }
.runs td { padding: 2px 6px 2px 0; }
</style>
