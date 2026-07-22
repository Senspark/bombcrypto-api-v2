<script setup lang="ts">
import {computed, ref} from "vue";
import {setBridgeFlag} from "../wallet";

const props = defineProps<{
    chainId: number;
    bridgeAddress: string;
    flag: "deposit" | "withdraw";
    enabled: boolean;
}>();
const emit = defineEmits<{(e: "changed"): void}>();

const busy = ref(false);
const err = ref("");
const label = computed(() => (props.flag === "deposit" ? "Deposit" : "Withdraw"));

async function toggle() {
    err.value = "";
    busy.value = true;
    try {
        await setBridgeFlag(props.chainId, props.bridgeAddress, props.flag, !props.enabled);
        emit("changed");
    } catch (e) {
        err.value = e instanceof Error ? e.message : String(e);
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <span class="toggle">
        <span class="badge" :class="enabled ? 'ok' : 'bad'">{{ label }} {{ enabled ? "bật" : "tắt" }}</span>
        <button class="btn tiny" :disabled="busy" @click="toggle">{{ busy ? "…" : enabled ? "Tắt" : "Bật" }}</button>
        <span v-if="err" class="error tiny-err" :title="err">lỗi</span>
    </span>
</template>

<style scoped>
.toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.tiny {
    padding: 2px 8px;
    font-size: 12px;
}

.tiny-err {
    padding: 0;
    font-size: 12px;
    cursor: help;
}
</style>
