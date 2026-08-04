<script setup lang="ts">
import {ref, watch} from "vue";
import {formatUnits, parseUnits} from "ethers";
import {CHAINS} from "./config";
import {readUsdtBalance, withdrawUsdt} from "./treasury";

const props = defineProps<{chainId: number; usdtAddress: string; owner: string | null}>();

const usdt = ref<bigint>(0n);
const decimals = ref(6);
const to = ref("");
const amount = ref("");
const busy = ref(false);
const txHash = ref("");
const err = ref("");

async function load() {
    const b = await readUsdtBalance(props.chainId, props.usdtAddress);
    usdt.value = b.usdt;
    decimals.value = b.decimals;
}

watch(() => props.owner, (o) => {
    if (o && !to.value) to.value = o; // default recipient = connected manager wallet
    void load().catch(() => {});
}, {immediate: true});

defineExpose({load}); // parent refreshes this after a swap adds USDT

function setMax() {
    amount.value = formatUnits(usdt.value, decimals.value);
}

async function onWithdraw() {
    err.value = "";
    txHash.value = "";
    busy.value = true;
    try {
        const raw = parseUnits(amount.value.trim(), decimals.value);
        if (raw <= 0n) throw new Error("Số lượng phải > 0");
        txHash.value = await withdrawUsdt(props.chainId, to.value.trim(), raw);
        amount.value = "";
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
            <input v-model="to" type="text" class="addr" placeholder="Địa chỉ nhận" :disabled="busy || !owner"/>
            <input v-model="amount" type="text" inputmode="decimal" class="amt" placeholder="Số USDT" :disabled="busy || !owner"/>
            <button class="btn max" :disabled="busy || usdt === 0n" @click="setMax">MAX</button>
            <button
                class="btn" :disabled="busy || !owner || !to.trim() || !amount.trim()"
                @click="onWithdraw"
            >{{ busy ? "..." : "Rút USDT" }}</button>
        </div>
        <a
            v-if="txHash" :href="CHAINS[chainId].explorerTx + txHash"
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

.addr {
    width: 280px;
}

.amt {
    width: 130px;
}

.max {
    padding: 6px 10px;
}
</style>
