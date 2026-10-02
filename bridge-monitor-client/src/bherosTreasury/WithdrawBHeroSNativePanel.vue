<script setup lang="ts">
import {ref, watch} from "vue";
import {formatEther, parseEther} from "ethers";
import {CHAINS, type BHeroSInstance} from "./config";
import {readBHeroSNativeBalance, withdrawBHeroSNative} from "./treasury";

const props = defineProps<{instance: BHeroSInstance; owner: string | null}>();

const balance = ref<bigint>(0n);
const to = ref("");
const amount = ref("");
const busy = ref(false);
const txHash = ref("");
const err = ref("");

async function load() {
    balance.value = await readBHeroSNativeBalance(props.instance);
}

watch(() => props.owner, (o) => {
    if (o && !to.value) to.value = o; // default recipient = connected manager wallet
    void load().catch(() => {});
}, {immediate: true});

function setMax() {
    amount.value = formatEther(balance.value);
}

async function onWithdraw() {
    err.value = "";
    txHash.value = "";
    busy.value = true;
    try {
        const raw = parseEther(amount.value.trim());
        if (raw <= 0n) throw new Error("Số lượng phải > 0");
        txHash.value = await withdrawBHeroSNative(props.instance, to.value.trim(), raw);
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
    <div class="card native">
        <h2>Treasury {{ instance.nativeSymbol }}</h2>
        <div class="muted bal">
            Trong contract: <span class="mono">{{ formatEther(balance) }} {{ instance.nativeSymbol }}</span>
        </div>
        <div class="row">
            <input v-model="to" type="text" class="addr" placeholder="Địa chỉ nhận" :disabled="busy || !owner"/>
            <input v-model="amount" type="text" inputmode="decimal" class="amt" :placeholder="`Số ${instance.nativeSymbol}`" :disabled="busy || !owner"/>
            <button class="btn max" :disabled="busy || balance === 0n" @click="setMax">MAX</button>
            <button
                class="btn" :disabled="busy || !owner || !to.trim() || !amount.trim()"
                @click="onWithdraw"
            >{{ busy ? "..." : `Rút ${instance.nativeSymbol}` }}</button>
        </div>
        <a
            v-if="txHash" :href="CHAINS[instance.chainId].explorerTx + txHash"
            target="_blank" rel="noreferrer" class="mono"
        >xem tx</a>
        <div v-if="err" class="error">{{ err }}</div>
    </div>
</template>

<style scoped>
.native {
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
