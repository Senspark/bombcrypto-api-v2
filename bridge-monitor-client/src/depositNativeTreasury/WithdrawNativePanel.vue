<script setup lang="ts">
import {computed, ref, watch} from "vue";
import {formatEther, parseEther} from "ethers";
import {CHAINS, type DepositNativeInstance} from "./config";
import {readDepositNativeInfo, withdrawDepositNative, type DepositNativeInfo} from "./treasury";

const props = defineProps<{instance: DepositNativeInstance; owner: string | null}>();

const info = ref<DepositNativeInfo | null>(null);
const to = ref("");
const amount = ref("");
const busy = ref(false);
const txHash = ref("");
const err = ref("");

async function load() {
    info.value = await readDepositNativeInfo(props.instance);
}

watch(() => props.owner, (o) => {
    if (o && !to.value) to.value = o; // default recipient = connected manager wallet
    void load().catch(() => {});
}, {immediate: true});

defineExpose({load});

// expectedLiability is what the vault must still be able to pay out to depositors.
const expectedLiability = computed(() => info.value ? info.value.totalDeposited - info.value.totalWithdrawn : 0n);
const belowLiability = computed(() => !!info.value && info.value.balance < expectedLiability.value);

function setMax() {
    if (info.value) amount.value = formatEther(info.value.balance);
}

async function onWithdraw() {
    err.value = "";
    txHash.value = "";
    busy.value = true;
    try {
        const raw = parseEther(amount.value.trim());
        if (raw <= 0n) throw new Error("Số lượng phải > 0");
        txHash.value = await withdrawDepositNative(props.instance, to.value.trim(), raw);
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
        <h2>Deposit Native</h2>

        <div v-if="info" class="muted fees">
            <div>Balance contract: <span class="mono">{{ formatEther(info.balance) }} {{ instance.nativeSymbol }}</span></div>
            <div>totalDeposited: <span class="mono">{{ formatEther(info.totalDeposited) }} {{ instance.nativeSymbol }}</span></div>
            <div>totalWithdrawn: <span class="mono">{{ formatEther(info.totalWithdrawn) }} {{ instance.nativeSymbol }}</span></div>
            <div>Còn nợ user (deposited - withdrawn): <span class="mono">{{ formatEther(expectedLiability) }} {{ instance.nativeSymbol }}</span></div>
        </div>

        <div v-if="belowLiability" class="warn">
            ⚠️ Balance đang THẤP HƠN số còn nợ user (deposited - withdrawn) — rút bất kỳ số nào
            cũng động vào tiền deposit của người dùng, không phải phần dư. Contract không chặn
            việc này (managerWithdraw không kiểm tra liability).
        </div>

        <div class="row">
            <input v-model="to" type="text" class="addr" placeholder="Địa chỉ nhận" :disabled="busy || !owner"/>
            <input v-model="amount" type="text" inputmode="decimal" class="amt" :placeholder="`Số ${instance.nativeSymbol}`" :disabled="busy || !owner"/>
            <button class="btn max" :disabled="busy || !info || info.balance === 0n" @click="setMax">MAX</button>
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
.usdt {
    background: var(--panel-2);
}

.fees {
    margin-bottom: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.warn {
    color: var(--warn, #f5a623);
    margin-bottom: 12px;
    font-size: 13px;
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
