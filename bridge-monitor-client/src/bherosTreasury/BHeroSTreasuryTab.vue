<script setup lang="ts">
import {computed, ref} from "vue";
import {shortAddr} from "../format";
import {BHEROS, BSC_CHAIN_ID, CHAINS, routesFor, type BHeroSInstance} from "./config";
import {connect} from "../treasury/wallet";
import BHeroSCard from "./BHeroSCard.vue";
import WithdrawBHeroSPanel from "./WithdrawBHeroSPanel.vue";

const owner = ref<string | null>(null);
const connecting = ref(false);
const err = ref("");
const panels = ref<Record<string, InstanceType<typeof WithdrawBHeroSPanel> | null>>({});

// Single group (only one BHeroS instance per chain, unlike Market's 2 labels) split into a BSC
// column and a Polygon column, same tinted-column layout as the other treasury tabs.
const chains = computed(() => {
    return [...BHEROS].sort((a, b) => (a.chainId === BSC_CHAIN_ID ? -1 : 1) - (b.chainId === BSC_CHAIN_ID ? -1 : 1));
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

function onSwapped(instanceId: string) {
    panels.value[instanceId]?.load();
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
        Manager (WITHDRAWER_ROLE) bấm swap: contract tự đổi phí Hero sale (toàn bộ balance
        bcoinToken/senToken, không có bookkeeping riêng) thành USDT giữ trong contract, rồi rút hết
        bằng <span class="mono">withdrawCustomToken</span>. Ví phải có WITHDRAWER_ROLE trên BHeroS
        contract, cần BNB/POL trả gas.
    </p>
    <div v-if="err" class="error">{{ err }}</div>

    <div class="chain-grid">
        <div
            v-for="instance in chains" :key="instance.id" class="chain-col"
            :class="instance.chainId === BSC_CHAIN_ID ? 'chain-col-bsc' : 'chain-col-polygon'"
        >
            <h3 class="chain-title">
                <span class="chip" :class="instance.chainId === BSC_CHAIN_ID ? 'chip-bsc' : 'chip-polygon'">{{ CHAINS[instance.chainId].name }}</span>
                <a class="mono" :href="CHAINS[instance.chainId].explorerAddress + instance.address" target="_blank" rel="noreferrer">{{ shortAddr(instance.address) }}</a>
            </h3>
            <BHeroSCard
                v-for="r in routesFor(instance)" :key="r.id" :instance="instance" :route="r" :owner="owner"
                @swapped="onSwapped(instance.id)"
            />
            <WithdrawBHeroSPanel
                :ref="(el) => (panels[instance.id] = el as any)"
                :instance="instance" :usdt-address="routesFor(instance)[0].tokenOut" :owner="owner"
            />
        </div>
    </div>
</template>
