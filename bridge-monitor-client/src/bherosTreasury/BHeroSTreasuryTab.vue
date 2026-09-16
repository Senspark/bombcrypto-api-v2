<script setup lang="ts">
import {computed, ref} from "vue";
import {shortAddr} from "../format";
import {BHEROS, BSC_CHAIN_ID, CHAINS, routesFor, type BHeroSInstance} from "./config";
import {walletAccount} from "../treasury/wallet";
import WalletToolbar from "../treasury/WalletToolbar.vue";
import DistributeCard from "./DistributeCard.vue";
import WithdrawBHeroSPanel from "./WithdrawBHeroSPanel.vue";

const panels = ref<Record<string, InstanceType<typeof WithdrawBHeroSPanel> | null>>({});

// Single group (only one BHeroS instance per chain, unlike Market's 2 labels) split into a BSC
// column and a Polygon column, same tinted-column layout as the other treasury tabs.
const chains = computed(() => {
    return [...BHEROS].sort((a, b) => (a.chainId === BSC_CHAIN_ID ? -1 : 1) - (b.chainId === BSC_CHAIN_ID ? -1 : 1));
});

function onSwapped(instanceId: string) {
    panels.value[instanceId]?.load();
}
</script>

<template>
    <WalletToolbar/>

    <p class="muted">
        Manager (WITHDRAWER_ROLE) chia phí Hero sale 4 chân trong một tx, cả 4 đều là chuyển token
        phí: community / marketing / burn sang 3 treasury, phần dev sang Treasury Dev — đổi sang USDT
        là thao tác riêng ở tab Treasury Dev. Toàn bộ balance là phí — BHeroS không giữ tiền của
        người dùng. Ví phải có WITHDRAWER_ROLE, cần BNB/POL trả gas.
    </p>

    <div class="chain-grid">
        <div
            v-for="instance in chains" :key="instance.id" class="chain-col"
            :class="instance.chainId === BSC_CHAIN_ID ? 'chain-col-bsc' : 'chain-col-polygon'"
        >
            <h3 class="chain-title">
                <span class="chip" :class="instance.chainId === BSC_CHAIN_ID ? 'chip-bsc' : 'chip-polygon'">{{ CHAINS[instance.chainId].name }}</span>
                <a class="mono" :href="CHAINS[instance.chainId].explorerAddress + instance.address" target="_blank" rel="noreferrer">{{ shortAddr(instance.address) }}</a>
            </h3>
            <DistributeCard
                v-for="r in routesFor(instance)" :key="r.id"
                :instance="instance" :route="r" :owner="walletAccount"
                @changed="onSwapped(instance.id)"
            />
            <WithdrawBHeroSPanel
                :ref="(el) => (panels[instance.id] = el as any)"
                :instance="instance" :usdt-address="routesFor(instance)[0].tokenOut" :owner="walletAccount"
            />
        </div>
    </div>
</template>
