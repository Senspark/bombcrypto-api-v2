<script setup lang="ts">
import {onMounted, ref} from "vue";
import {shortAddr} from "../format";
import {connect, disconnect, restoreConnection, walletAccount} from "./wallet";

const busy = ref(false);
const err = ref("");

onMounted(() => void restoreConnection());

async function onConnect() {
    err.value = "";
    busy.value = true;
    try {
        await connect();
    } catch (e) {
        err.value = e instanceof Error ? e.message : String(e);
    } finally {
        busy.value = false;
    }
}

async function onDisconnect() {
    err.value = "";
    busy.value = true;
    try {
        await disconnect();
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <div class="toolbar">
        <button v-if="!walletAccount" class="btn" :disabled="busy" @click="onConnect">
            {{ busy ? "..." : "Kết nối ví manager" }}
        </button>
        <template v-else>
            <span class="muted mono">Ví: {{ shortAddr(walletAccount) }}</span>
            <button class="btn" :disabled="busy" @click="onDisconnect">Ngắt kết nối</button>
        </template>
    </div>
    <div v-if="err" class="error">{{ err }}</div>
</template>
