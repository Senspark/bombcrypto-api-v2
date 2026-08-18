<script setup lang="ts">
import {computed, ref} from "vue";
import {shortAddr} from "../format";
import {BSC_CHAIN_ID, CHAINS, DEV_TREASURIES, routesFor, type DevTreasuryInstance} from "./config";
import {walletAccount} from "../treasury/wallet";
import WalletToolbar from "../treasury/WalletToolbar.vue";
import DevSwapCard from "./DevSwapCard.vue";
import WithdrawDevPanel from "./WithdrawDevPanel.vue";

const panels = ref<Record<string, InstanceType<typeof WithdrawDevPanel> | null>>({});

const chains = computed<DevTreasuryInstance[]>(() =>
    [...DEV_TREASURIES].sort((a, b) => (a.chainId === BSC_CHAIN_ID ? -1 : 1) - (b.chainId === BSC_CHAIN_ID ? -1 : 1)),
);

function onSwapped(instanceId: string) {
    panels.value[instanceId]?.load();
}
</script>

<template>
    <WalletToolbar/>

    <p class="muted">
        Treasury Dev nhận phần dev của mọi lần chia từ BHeroS và BHeroStake, dưới dạng chính token phí.
        Đổi sang USDT ở đây là một thao tác riêng, do người bấm chọn thời điểm — USDT ở lại contract
        này cho tới khi rút. Ví phải có DEFAULT_ADMIN_ROLE trên Treasury Dev, cần BNB/POL trả gas.
    </p>

    <div class="chain-grid">
        <div
            v-for="instance in chains" :key="instance.id" class="chain-col"
            :class="instance.chainId === BSC_CHAIN_ID ? 'chain-col-bsc' : 'chain-col-polygon'"
        >
            <h3 class="chain-title">
                <span class="chip" :class="instance.chainId === BSC_CHAIN_ID ? 'chip-bsc' : 'chip-polygon'">{{ CHAINS[instance.chainId].name }}</span>
                <a
                    v-if="instance.address" class="mono"
                    :href="CHAINS[instance.chainId].explorerAddress + instance.address" target="_blank" rel="noreferrer"
                >{{ shortAddr(instance.address) }}</a>
            </h3>

            <div v-if="!instance.address" class="card warn">
                Chain này chưa deploy Treasury Dev — chạy <span class="mono">deploy-treasury-dev.js</span>
                rồi điền địa chỉ vào <span class="mono">devTreasury/config.ts</span>.
            </div>
            <template v-else>
                <DevSwapCard
                    v-for="r in routesFor(instance)" :key="r.id"
                    :instance="instance" :route="r" :owner="walletAccount"
                    @swapped="onSwapped(instance.id)"
                />
                <WithdrawDevPanel
                    :ref="(el) => (panels[instance.id] = el as any)"
                    :instance="instance" :usdt-address="routesFor(instance)[0].tokenOut" :owner="walletAccount"
                />
            </template>
        </div>
    </div>
</template>

<style scoped>
.warn {
    color: var(--warn, #f5a623);
    font-size: 13px;
}
</style>
