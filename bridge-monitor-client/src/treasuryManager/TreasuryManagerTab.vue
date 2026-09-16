<script setup lang="ts">
import {computed, ref} from "vue";
import {shortAddr} from "../format";
import {CHAINS} from "../treasury/config";
import {POLL_MS, usePoll} from "../usePoll";
import {
    api,
    type ScheduleConfig,
    type ScheduleState,
    type SwapRoute,
    type TreasuryInstance,
} from "./api";
import LoginGate from "./LoginGate.vue";
import ScheduleCard from "./ScheduleCard.vue";

const operator = ref<string | null>(null);
const instances = ref<TreasuryInstance[]>([]);
const routes = ref<SwapRoute[]>([]);
const schedules = ref<Record<string, {config: ScheduleConfig; state: ScheduleState}>>({});
const err = ref("");

const groups = computed(() => {
    const labels = [...new Set(instances.value.map((i) => i.label))];
    return labels.map((label) => ({
        label,
        chains: instances.value.filter((i) => i.label === label),
    }));
});

function routesFor(instance: TreasuryInstance): SwapRoute[] {
    return routes.value.filter((r) => r.chainId === instance.chainId);
}

function entryFor(instance: TreasuryInstance, route: SwapRoute) {
    return schedules.value[`${instance.id}:${route.id}`] ?? null;
}

async function onAuthenticated(email: string) {
    operator.value = email;
    try {
        const catalog = await api.catalog();
        instances.value = catalog.instances;
        routes.value = catalog.routes;
        await refresh();
    } catch (e) {
        err.value = e instanceof Error ? e.message : String(e);
    }
}

async function refresh() {
    const {schedules: list} = await api.schedules();
    const next: Record<string, {config: ScheduleConfig; state: ScheduleState}> = {};
    for (const entry of list) next[entry.config.id] = entry;
    schedules.value = next;
}

// The ticker changes state server-side, so the panel polls rather than waiting for a user action.
usePoll(() => {
    if (!operator.value) return;
    void refresh().catch(() => {});
}, POLL_MS);

async function onLogout() {
    await api.logout().catch(() => {});
    operator.value = null;
}
</script>

<template>
    <LoginGate v-if="!operator" @authenticated="onAuthenticated"/>

    <template v-else>
        <div class="toolbar">
            <span class="muted">{{ operator }}</span>
            <button class="btn ghost" @click="onLogout">Đăng xuất</button>
        </div>

        <p class="muted">
            Backend giữ ví manager (WITHDRAWER_ROLE) và tự gọi
            <span class="mono">swapToUSDT</span> theo lịch: mỗi chu kỳ swap một lượng cố định, cộng dồn
            tới mức tối đa thì tự dừng. USDT nằm lại trong contract — rút vẫn phải bấm tay ở tab
            Market Treasury. Chỉ 4 market chạy ở đây; BHeroS và BHeroStake chia phí qua splitter,
            thao tác ở tab của chúng.
        </p>
        <div v-if="err" class="error">{{ err }}</div>

        <section v-for="g in groups" :key="g.label" class="market-group">
            <h2 class="market-title">{{ g.label }}</h2>
            <div class="chain-grid">
                <div v-for="inst in g.chains" :key="inst.id" class="chain-col">
                    <h3 class="chain-title">
                        <span class="chip">{{ CHAINS[inst.chainId].name }}</span>
                        <a
                            class="mono" :href="CHAINS[inst.chainId].explorerAddress + inst.address"
                            target="_blank" rel="noreferrer"
                        >{{ shortAddr(inst.address) }}</a>
                    </h3>
                    <ScheduleCard
                        v-for="r in routesFor(inst)" :key="r.id"
                        :instance="inst" :route="r" :entry="entryFor(inst, r)"
                        @changed="refresh"
                    />
                </div>
            </div>
        </section>
    </template>
</template>

<style scoped>
.toolbar { display: flex; align-items: center; gap: 12px; }
.btn.ghost { background: transparent; }
</style>
