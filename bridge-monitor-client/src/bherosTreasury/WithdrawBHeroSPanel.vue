<script setup lang="ts">
import {ref, watch} from "vue";
import {formatUnits} from "ethers";
import {CHAINS, type BHeroSInstance} from "./config";
import {readBHeroSUsdtBalance, withdrawBHeroSToken} from "./treasury";

const props = defineProps<{instance: BHeroSInstance; usdtAddress: string; owner: string | null}>();

const usdt = ref<bigint>(0n);
const decimals = ref(6);
const busy = ref(false);
const txHash = ref("");
const err = ref("");

async function load() {
    const b = await readBHeroSUsdtBalance(props.instance, props.usdtAddress);
    usdt.value = b.usdt;
    decimals.value = b.decimals;
}

watch(() => props.owner, () => void load().catch(() => {}), {immediate: true});

defineExpose({load}); // parent refreshes this after a swap adds USDT

async function onWithdraw() {
    err.value = "";
    txHash.value = "";
    busy.value = true;
    try {
        // withdrawCustomToken sweeps the entire USDT balance to the connected (WITHDRAWER_ROLE) wallet.
        txHash.value = await withdrawBHeroSToken(props.instance, props.usdtAddress);
        await load().catch(() => {});
    } catch (e) {
        err.value = e instanceof Error ? e.message : String(e);
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <div class="card usdt">
        <h2>Treasury USDT</h2>
        <div class="muted bal">
            Trong contract: <span class="mono">{{ formatUnits(usdt, decimals) }} USDT</span>
        </div>
        <div class="row">
            <button
                class="btn" :disabled="busy || !owner || usdt === 0n"
                @click="onWithdraw"
            >{{ busy ? "..." : "Rút hết USDT về ví" }}</button>
        </div>
        <a
            v-if="txHash" :href="CHAINS[instance.chainId].explorerTx + txHash"
            target="_blank" rel="noreferrer" class="mono"
        >xem tx</a>
        <div v-if="err" class="error">{{ err }}</div>
    </div>
</template>

<style scoped>
.usdt {
    background: var(--panel-2);
}

.bal {
    margin-bottom: 10px;
}

.row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}
</style>
