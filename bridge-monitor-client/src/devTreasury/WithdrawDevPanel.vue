<script setup lang="ts">
// Move USDT out of TreasuryDev. withdrawTo takes an explicit receiver and amount — there is no
// sweep-everything call here — so the receiver defaults to the connected wallet and is editable.
import {ref, watch} from "vue";
import {formatUnits, parseUnits} from "ethers";
import {CHAINS, type DevTreasuryInstance} from "./config";
import {readDevTokenBalance, withdrawDevToken} from "./treasury";

const props = defineProps<{instance: DevTreasuryInstance; usdtAddress: string; owner: string | null}>();

const balance = ref<bigint>(0n);
const decimals = ref(6);
const receiver = ref("");
const amount = ref("");
const busy = ref(false);
const txHash = ref("");
const err = ref("");

async function load() {
    if (!props.instance.address) return;
    const r = await readDevTokenBalance(props.instance, props.usdtAddress);
    balance.value = r.balance;
    decimals.value = r.decimals;
}

watch(
    () => props.owner,
    (owner) => {
        if (owner && !receiver.value) receiver.value = owner;
        void load().catch(() => {});
    },
    {immediate: true},
);

defineExpose({load}); // parent refreshes this after a swap adds USDT

function setMax() {
    amount.value = formatUnits(balance.value, decimals.value);
}

async function onWithdraw() {
    err.value = "";
    txHash.value = "";
    busy.value = true;
    try {
        const value = parseUnits(amount.value.trim(), decimals.value);
        if (value <= 0n) throw new Error("Số lượng phải > 0");
        if (value > balance.value) throw new Error("Vượt quá số dư của Treasury Dev");
        txHash.value = await withdrawDevToken(props.instance, props.usdtAddress, receiver.value.trim(), value);
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
        <h2>USDT của Treasury Dev</h2>
        <div class="muted bal">
            Đang giữ: <span class="mono">{{ formatUnits(balance, decimals) }} USDT</span>
        </div>
        <div class="row">
            <input v-model="receiver" type="text" class="addr" placeholder="Ví nhận" :disabled="busy"/>
            <input v-model="amount" type="text" inputmode="decimal" placeholder="Số USDT" :disabled="busy || !owner"/>
            <button class="btn max" :disabled="busy || balance === 0n" @click="setMax">MAX</button>
            <button
                class="btn" :disabled="busy || !owner || !amount.trim() || !receiver.trim()"
                @click="onWithdraw"
            >{{ busy ? "..." : "Rút USDT" }}</button>
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

.row input[type="text"] {
    width: 160px;
}

.addr {
    width: 360px !important;
}

.max {
    padding: 6px 10px;
}
</style>
