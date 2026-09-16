<script setup lang="ts">
import {computed, ref} from "vue";
import {shortAddr} from "../format";
import {BSC_CHAIN_ID, CHAINS, DEPOSIT_NATIVES} from "./config";
import {walletAccount} from "../treasury/wallet";
import WalletToolbar from "../treasury/WalletToolbar.vue";
import LoginGate from "../treasuryManager/LoginGate.vue";
import WithdrawNativePanel from "./WithdrawNativePanel.vue";
import NativeStatsPanel from "./NativeStatsPanel.vue";
import ExcludedUidsCard from "./ExcludedUidsCard.vue";
import {nativeApi, type NativeSummary} from "./api";

const operator = ref<string | null>(null);
const summaries = ref<Record<string, NativeSummary>>({});
const excludedUids = ref<number[]>([]);
const err = ref("");

const chains = computed(() => {
    return [...DEPOSIT_NATIVES].sort((a, b) => (a.chainId === BSC_CHAIN_ID ? -1 : 1) - (b.chainId === BSC_CHAIN_ID ? -1 : 1));
});

async function onAuthenticated(email: string) {
    operator.value = email;
    await refresh();
}

async function refresh() {
    err.value = "";
    try {
        const loaded = await Promise.all(DEPOSIT_NATIVES.map((d) => nativeApi.summary(d.network)));
        const next: Record<string, NativeSummary> = {};
        for (const summary of loaded) next[summary.network] = summary;
        summaries.value = next;
        excludedUids.value = loaded[0]?.excludedUids ?? [];
    } catch (e) {
        err.value = e instanceof Error ? e.message : String(e);
    }
}

function onExcludedSaved(uids: number[]) {
    excludedUids.value = uids;
    void refresh();
}
</script>

<template>
    <WalletToolbar/>

    <p class="muted">
        DepositNative giữ tiền native (BNB/POL) user đã gửi vào. Manager (MANAGER_ROLE) rút bằng
        <span class="mono">managerWithdraw(to, amount)</span> — không có sweep-all, phải nhập rõ
        địa chỉ + số lượng, vì rút quá tay sẽ động vào tiền user chưa withdraw. Ví phải có
        MANAGER_ROLE trên contract, cần BNB/POL trả gas.
    </p>

    <LoginGate v-if="!operator" @authenticated="onAuthenticated"/>
    <ExcludedUidsCard v-else :uids="excludedUids" @saved="onExcludedSaved"/>
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
            <WithdrawNativePanel :instance="instance" :owner="walletAccount" :summary="summaries[instance.network] ?? null"/>
            <NativeStatsPanel :instance="instance" :summary="summaries[instance.network] ?? null"/>
        </div>
    </div>
</template>
