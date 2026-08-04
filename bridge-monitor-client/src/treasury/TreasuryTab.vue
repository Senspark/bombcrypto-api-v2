<script setup lang="ts">
import {computed, ref} from "vue";
import {shortAddr} from "../format";
import {BRIDGES, CHAINS, ROUTES} from "./config";
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
    return [...byChain.entries()].map(([chainId, routes]) => ({chainId, routes, usdtAddress: routes[0].tokenOut}));
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

    <section v-for="g in groups" :key="g.chainId">
        <h3 class="section">
            {{ CHAINS[g.chainId].name }}
            <span class="muted mono">bridge {{ shortAddr(BRIDGES[g.chainId]) }}</span>
        </h3>
        <TreasuryCard
            v-for="r in g.routes" :key="r.id" :route="r" :owner="owner"
            @swapped="onSwapped(g.chainId)"
        />
        <WithdrawPanel
            :ref="(el) => (panels[g.chainId] = el as any)"
            :chain-id="g.chainId" :usdt-address="g.usdtAddress" :owner="owner"
        />
    </section>
</template>

<style scoped>
.section {
    margin: 18px 0 12px;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    display: flex;
    gap: 10px;
    align-items: baseline;
}

.section .mono {
    text-transform: none;
    letter-spacing: 0;
    font-size: 12px;
}
</style>
