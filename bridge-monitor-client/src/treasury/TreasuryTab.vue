<script setup lang="ts">
import {computed, ref} from "vue";
import {shortAddr} from "../format";
import {BRIDGES, BSC_CHAIN_ID, CHAINS, ROUTES} from "./config";
import {connect} from "./wallet";
import TreasuryCard from "./TreasuryCard.vue";
import WithdrawPanel from "./WithdrawPanel.vue";

const owner = ref<string | null>(null);
const connecting = ref(false);
const err = ref("");
const panels = ref<Record<number, InstanceType<typeof WithdrawPanel> | null>>({});

const groups = computed(() => {
    const byChain = new Map<number, typeof ROUTES>();
    for (const r of ROUTES) {
        const list = byChain.get(r.chainId) ?? [];
        list.push(r);
        byChain.set(r.chainId, list);
    }
    // usdtAddress is the tokenOut of any route on the chain (all routes on a chain share USDT).
    // BSC column always left, Polygon always right — independent of ROUTES declaration order.
    return [...byChain.entries()]
        .map(([chainId, routes]) => ({chainId, routes, usdtAddress: routes[0].tokenOut}))
        .sort((a, b) => (a.chainId === BSC_CHAIN_ID ? -1 : 1) - (b.chainId === BSC_CHAIN_ID ? -1 : 1));
});

async function onConnect() {
    err.value = "";
    connecting.value = true;
    try {
        owner.value = await connect();
    } catch (e) {
        err.value = e instanceof Error ? e.message : String(e);
    } finally {
        connecting.value = false;
    }
}

function onSwapped(chainId: number) {
    panels.value[chainId]?.load();
}
</script>

<template>
    <div class="toolbar">
        <button v-if="!owner" class="btn" :disabled="connecting" @click="onConnect">
            {{ connecting ? "..." : "Kết nối ví manager" }}
        </button>
        <span v-else class="muted mono">Ví: {{ shortAddr(owner) }}</span>
    </div>

    <p class="muted">
        Manager (MANAGER_ROLE) bấm swap: contract tự đổi fee (collectedFees) thành USDT giữ trong contract,
        rồi rút riêng. Ví phải có MANAGER_ROLE trên DepositBridge, cần BNB/POL trả gas.
    </p>
    <div v-if="err" class="error">{{ err }}</div>

    <div class="chain-grid">
        <div v-for="g in groups" :key="g.chainId" class="chain-col" :class="g.chainId === BSC_CHAIN_ID ? 'chain-col-bsc' : 'chain-col-polygon'">
            <h3 class="chain-title">
                <span class="chip" :class="g.chainId === BSC_CHAIN_ID ? 'chip-bsc' : 'chip-polygon'">{{ CHAINS[g.chainId].name }}</span>
                <span class="muted">bridge</span>
                <a class="mono" :href="CHAINS[g.chainId].explorerAddress + BRIDGES[g.chainId]" target="_blank" rel="noreferrer">{{ shortAddr(BRIDGES[g.chainId]) }}</a>
            </h3>
            <TreasuryCard
                v-for="r in g.routes" :key="r.id" :route="r" :owner="owner"
                @swapped="onSwapped(g.chainId)"
            />
            <WithdrawPanel
                :ref="(el) => (panels[g.chainId] = el as any)"
                :chain-id="g.chainId" :usdt-address="g.usdtAddress" :owner="owner"
            />
        </div>
    </div>
</template>
