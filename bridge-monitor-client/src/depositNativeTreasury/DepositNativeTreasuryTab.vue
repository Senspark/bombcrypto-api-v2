<script setup lang="ts">
import {computed} from "vue";
import {shortAddr} from "../format";
import {BSC_CHAIN_ID, CHAINS, DEPOSIT_NATIVES} from "./config";
import {walletAccount} from "../treasury/wallet";
import WalletToolbar from "../treasury/WalletToolbar.vue";
import WithdrawNativePanel from "./WithdrawNativePanel.vue";

const chains = computed(() => {
    return [...DEPOSIT_NATIVES].sort((a, b) => (a.chainId === BSC_CHAIN_ID ? -1 : 1) - (b.chainId === BSC_CHAIN_ID ? -1 : 1));
});
</script>

<template>
    <WalletToolbar/>

    <p class="muted">
        DepositNative giữ tiền native (BNB/POL) user đã gửi vào. Manager (MANAGER_ROLE) rút bằng
        <span class="mono">managerWithdraw(to, amount)</span> — không có sweep-all, phải nhập rõ
        địa chỉ + số lượng, vì rút quá tay sẽ động vào tiền user chưa withdraw. Ví phải có
        MANAGER_ROLE trên contract, cần BNB/POL trả gas.
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
            <WithdrawNativePanel :instance="instance" :owner="walletAccount"/>
        </div>
    </div>
</template>
