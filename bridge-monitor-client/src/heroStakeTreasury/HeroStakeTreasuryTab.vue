<script setup lang="ts">
import {computed, ref} from "vue";
import {shortAddr} from "../format";
import {BSC_CHAIN_ID, CHAINS, HERO_STAKES, routesFor} from "./config";
import {walletAccount} from "../treasury/wallet";
import WalletToolbar from "../treasury/WalletToolbar.vue";
import HeroStakeCard from "./HeroStakeCard.vue";
import WithdrawHeroStakePanel from "./WithdrawHeroStakePanel.vue";

const panels = ref<Record<string, InstanceType<typeof WithdrawHeroStakePanel> | null>>({});

// One instance per chain, BSC column then Polygon, same tinted-column layout as the other tabs.
const chains = computed(() =>
    [...HERO_STAKES].sort((a, b) => (a.chainId === BSC_CHAIN_ID ? -1 : 1) - (b.chainId === BSC_CHAIN_ID ? -1 : 1)),
);

function onChanged(instanceId: string) {
    panels.value[instanceId]?.load();
}
</script>

<template>
    <WalletToolbar/>

    <p class="muted">
        Khác mọi tab treasury còn lại: BHeroStake giữ tiền gốc của staker. Chỉ phần đã vào sổ phí
        unstake (<span class="mono">withdrawFeeAmountsV2</span>) mới chia được — contract revert
        <span class="mono">Exceeds fee</span> nếu vượt, nên mỗi card hiện rõ sổ phí và tiền gốc tách
        riêng, và nút MAX lấy theo sổ chứ không theo số dư. Phần dev chuyển sang Treasury Dev dưới dạng
        token phí và đổi sang USDT ở tab đó. Số USDT còn trong sổ là của những lần chia trước khi có
        Treasury Dev, vẫn rút được. Ví phải có WITHDRAWER_ROLE, cần BNB/POL trả gas.
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
            <HeroStakeCard
                v-for="r in routesFor(instance)" :key="r.id" :instance="instance" :route="r" :owner="walletAccount"
                @changed="onChanged(instance.id)"
            />
            <WithdrawHeroStakePanel
                :ref="(el) => (panels[instance.id] = el as any)"
                :instance="instance" :usdt-address="routesFor(instance)[0].tokenOut" :owner="walletAccount"
            />
        </div>
    </div>
</template>
