<script setup lang="ts">
import {ref} from "vue";
import {fundLiquidity} from "../wallet";
import {txUrl} from "../explorers";

const props = defineProps<{
    chainId: number;
    bridgeAddress: string;
    tokenAddress: string;
    symbol: string;
}>();
const emit = defineEmits<{(e: "funded"): void}>();

const open = ref(false);
const amount = ref("");
const busy = ref(false);
const status = ref("");
const txHash = ref("");
const err = ref("");

async function submit() {
    err.value = "";
    status.value = "";
    txHash.value = "";
    busy.value = true;
    try {
        const hash = await fundLiquidity(
            props.chainId, props.bridgeAddress, props.tokenAddress, amount.value.trim(),
            (step) => (status.value = step === "approve" ? "Đang cấp quyền…" : "Đang Fund…"),
        );
        txHash.value = hash;
        status.value = "Đã Fund";
        open.value = false;
        amount.value = "";
        emit("funded");
    } catch (e) {
        err.value = e instanceof Error ? e.message : String(e);
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <div class="fund">
        <button v-if="!open" class="btn" @click="open = true">Fund</button>
        <div v-else class="fund-form">
            <input
                v-model="amount" type="text" inputmode="decimal"
                :placeholder="`Số ${symbol}`" :disabled="busy"
                @keyup.enter="submit"
            />
            <button class="btn" :disabled="busy || !amount.trim()" @click="submit">{{ busy ? "…" : "OK" }}</button>
            <button class="btn" :disabled="busy" @click="open = false">Huỷ</button>
        </div>
        <div v-if="status" class="muted">{{ status }}</div>
        <a v-if="txHash" :href="txUrl(chainId, txHash)" target="_blank" rel="noreferrer" class="mono">xem tx</a>
        <div v-if="err" class="error fund-err">{{ err }}</div>
    </div>
</template>

<style scoped>
.fund {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.fund-form {
    display: flex;
    align-items: center;
    gap: 6px;
}

.fund-form input {
    width: 130px;
}

.fund-err {
    padding: 0;
}
</style>
