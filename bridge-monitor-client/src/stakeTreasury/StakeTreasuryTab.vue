<script setup lang="ts">
import {computed, ref} from "vue";
import {shortAddr} from "../format";
import {BSC_CHAIN_ID, CHAINS, POLYGON_CHAIN_ID, STAKES, routesFor, type StakeInstance} from "./config";
import {walletAccount} from "../treasury/wallet";
import WalletToolbar from "../treasury/WalletToolbar.vue";
import StakeCard from "./StakeCard.vue";
import WithdrawStakePanel from "./WithdrawStakePanel.vue";

const panels = ref<Record<string, InstanceType<typeof WithdrawStakePanel> | null>>({});

// Two clearly separated blocks (BCoinStake / SenStake), each split into a BSC column and a
// Polygon column, same treatment as Market Treasury.
const stakeGroups = computed(() => {
    const labels = [...new Set(STAKES.map((m) => m.label))];
    return labels.map((label) => ({
        label,
        bsc: STAKES.find((m) => m.label === label && m.chainId === BSC_CHAIN_ID) as StakeInstance,
        polygon: STAKES.find((m) => m.label === label && m.chainId === POLYGON_CHAIN_ID) as StakeInstance,
    }));
});

function onSwapped(stakeId: string) {
    panels.value[stakeId]?.load();
}
</script>

<template>
    <WalletToolbar/>

    <p class="muted">
        Manager (DEFAULT_ADMIN_ROLE) bấm swap: contract đổi 1 phần/toàn bộ balance token
        (stakingToken) thành USDT giữ trong contract, rồi rút hết bằng
        <span class="mono">withdrawTokenV2</span>. Contract KHÔNG chặn swap vượt quá phần dư so
        với totalStake (tiền gốc người dùng) — balance thấp hơn totalStake vẫn swap được, phần
        thiếu do manager tự nạp bù khi có người rút. Cẩn thận, xem cột "totalStake" trên mỗi card
        trước khi swap. Ví cần BNB/POL trả gas.
    </p>

    <section v-for="g in stakeGroups" :key="g.label" class="market-group">
        <h2 class="market-title">{{ g.label }}</h2>
        <div class="chain-grid">
            <div class="chain-col chain-col-bsc">
                <h3 class="chain-title">
                    <span class="chip chip-bsc">{{ CHAINS[g.bsc.chainId].name }}</span>
                    <a class="mono" :href="CHAINS[g.bsc.chainId].explorerAddress + g.bsc.address" target="_blank" rel="noreferrer">{{ shortAddr(g.bsc.address) }}</a>
                </h3>
                <StakeCard
                    v-for="r in routesFor(g.bsc)" :key="r.id" :stake="g.bsc" :route="r" :owner="walletAccount"
                    @swapped="onSwapped(g.bsc.id)"
                />
                <WithdrawStakePanel
                    :ref="(el) => (panels[g.bsc.id] = el as any)"
                    :stake="g.bsc" :usdt-address="routesFor(g.bsc)[0].tokenOut" :owner="walletAccount"
                />
            </div>
            <div class="chain-col chain-col-polygon">
                <h3 class="chain-title">
                    <span class="chip chip-polygon">{{ CHAINS[g.polygon.chainId].name }}</span>
                    <a class="mono" :href="CHAINS[g.polygon.chainId].explorerAddress + g.polygon.address" target="_blank" rel="noreferrer">{{ shortAddr(g.polygon.address) }}</a>
                </h3>
                <StakeCard
                    v-for="r in routesFor(g.polygon)" :key="r.id" :stake="g.polygon" :route="r" :owner="walletAccount"
                    @swapped="onSwapped(g.polygon.id)"
                />
                <WithdrawStakePanel
                    :ref="(el) => (panels[g.polygon.id] = el as any)"
                    :stake="g.polygon" :usdt-address="routesFor(g.polygon)[0].tokenOut" :owner="walletAccount"
                />
            </div>
        </div>
    </section>
</template>
