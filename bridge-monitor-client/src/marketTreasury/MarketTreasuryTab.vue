<script setup lang="ts">
import {computed, ref} from "vue";
import {shortAddr} from "../format";
import {BSC_CHAIN_ID, CHAINS, MARKETS, POLYGON_CHAIN_ID, routesFor, type MarketInstance} from "./config";
import {connect} from "../treasury/wallet";
import MarketCard from "./MarketCard.vue";
import WithdrawMarketPanel from "./WithdrawMarketPanel.vue";

const owner = ref<string | null>(null);
const connecting = ref(false);
const err = ref("");
const panels = ref<Record<string, InstanceType<typeof WithdrawMarketPanel> | null>>({});

// Two clearly separated blocks (BHeroMarket / BHouseMarket), each split into a BSC column and a
// Polygon column so the 4 contract instances never blur into one long list.
const marketGroups = computed(() => {
    const labels = [...new Set(MARKETS.map((m) => m.label))];
    return labels.map((label) => ({
        label,
        bsc: MARKETS.find((m) => m.label === label && m.chainId === BSC_CHAIN_ID) as MarketInstance,
        polygon: MARKETS.find((m) => m.label === label && m.chainId === POLYGON_CHAIN_ID) as MarketInstance,
    }));
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

function onSwapped(marketId: string) {
    panels.value[marketId]?.load();
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
        Manager (WITHDRAWER_ROLE) bấm swap: contract tự đổi phí marketplace (toàn bộ balance token,
        không có bookkeeping riêng) thành USDT giữ trong contract, rồi rút hết bằng
        <span class="mono">withdrawV2</span>. Ví phải có WITHDRAWER_ROLE trên market contract, cần
        BNB/POL trả gas.
    </p>
    <div v-if="err" class="error">{{ err }}</div>

    <section v-for="g in marketGroups" :key="g.label" class="market-group">
        <h2 class="market-title">{{ g.label }}</h2>
        <div class="chain-grid">
            <div class="chain-col chain-col-bsc">
                <h3 class="chain-title">
                    <span class="chip chip-bsc">{{ CHAINS[g.bsc.chainId].name }}</span>
                    <a class="mono" :href="CHAINS[g.bsc.chainId].explorerAddress + g.bsc.address" target="_blank" rel="noreferrer">{{ shortAddr(g.bsc.address) }}</a>
                </h3>
                <MarketCard
                    v-for="r in routesFor(g.bsc)" :key="r.id" :market="g.bsc" :route="r" :owner="owner"
                    @swapped="onSwapped(g.bsc.id)"
                />
                <WithdrawMarketPanel
                    :ref="(el) => (panels[g.bsc.id] = el as any)"
                    :market="g.bsc" :usdt-address="routesFor(g.bsc)[0].tokenOut" :owner="owner"
                />
            </div>
            <div class="chain-col chain-col-polygon">
                <h3 class="chain-title">
                    <span class="chip chip-polygon">{{ CHAINS[g.polygon.chainId].name }}</span>
                    <a class="mono" :href="CHAINS[g.polygon.chainId].explorerAddress + g.polygon.address" target="_blank" rel="noreferrer">{{ shortAddr(g.polygon.address) }}</a>
                </h3>
                <MarketCard
                    v-for="r in routesFor(g.polygon)" :key="r.id" :market="g.polygon" :route="r" :owner="owner"
                    @swapped="onSwapped(g.polygon.id)"
                />
                <WithdrawMarketPanel
                    :ref="(el) => (panels[g.polygon.id] = el as any)"
                    :market="g.polygon" :usdt-address="routesFor(g.polygon)[0].tokenOut" :owner="owner"
                />
            </div>
        </div>
    </section>
</template>
