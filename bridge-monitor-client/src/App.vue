<script setup lang="ts">
import {onMounted, ref} from "vue";
import {api} from "./api";
import AggregateView from "./components/AggregateView.vue";
import HealthView from "./components/HealthView.vue";
import GapsView from "./components/GapsView.vue";
import AnomaliesView from "./components/AnomaliesView.vue";
import WalletsView from "./components/WalletsView.vue";
import LifecycleView from "./components/LifecycleView.vue";
import TransactionsView from "./components/TransactionsView.vue";

// Running backend build identity. `code` is a hash of the actual running bytes — if it does NOT change after a
// deploy, the new code did not take effect (cache hit / container not recreated), regardless of the version bump.
const version = ref<string>("");
const code = ref<string>("");
onMounted(async () => {
    try {
        const v = await api.version();
        version.value = v.version;
        code.value = v.code;
    } catch {
        version.value = "?";
    }
});

const tabs = [
    {key: "aggregate", label: "Tổng quan"},
    {key: "transactions", label: "Giao dịch"},
    {key: "wallets", label: "Wallet"},
    {key: "anomalies", label: "Bất thường"},
    {key: "gaps", label: "Khoảng trống / Bù dữ liệu"},
    {key: "lifecycle", label: "Vòng đời withdraw"},
    {key: "health", label: "Tình trạng"},
] as const;

// Tab ↔ URL hash (e.g. .../#wallets) so a given tab is shareable by link and survives reload/back-forward.
// Hash (not a real path) needs no server-side SPA rewrite — works wherever the static build is served.
const keys = tabs.map((t) => t.key) as readonly string[];
function tabFromHash(): string {
    const h = window.location.hash.replace(/^#\/?/, "");
    return keys.includes(h) ? h : "aggregate";
}

const active = ref<string>(tabFromHash());

function select(key: string): void {
    active.value = key;
    if (tabFromHash() !== key) window.location.hash = key;
}

// React to manual URL edits / browser back-forward.
window.addEventListener("hashchange", () => {
    active.value = tabFromHash();
});
</script>

<template>
    <header class="app-header">
        <h1>Giám sát Bridge</h1>
        <span class="sub">DepositBridge cross-chain &mdash; giám sát + Fund thanh khoản</span>
        <span v-if="version" class="version" :title="'Build backend đang chạy — code là hash bytecode thực thi'">
            backend: {{ version }} <strong>code {{ code }}</strong>
        </span>
    </header>

    <nav class="tabs">
        <button
            v-for="t in tabs"
            :key="t.key"
            :class="{active: active === t.key}"
            @click="select(t.key)"
        >{{ t.label }}</button>
    </nav>

    <main class="content">
        <AggregateView v-if="active === 'aggregate'"/>
        <TransactionsView v-else-if="active === 'transactions'"/>
        <AnomaliesView v-else-if="active === 'anomalies'"/>
        <GapsView v-else-if="active === 'gaps'"/>
        <WalletsView v-else-if="active === 'wallets'"/>
        <LifecycleView v-else-if="active === 'lifecycle'"/>
        <HealthView v-else-if="active === 'health'"/>
    </main>
</template>
