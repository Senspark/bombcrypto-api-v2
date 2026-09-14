<script setup lang="ts">
import {computed, ref, watch} from "vue";
import {formatEther, parseEther} from "ethers";
import {CHAINS, type DepositNativeInstance} from "./config";
import {readDepositNativeInfo, withdrawDepositNative, type DepositNativeInfo} from "./treasury";
import {spentInGameAll, type NativeSummary} from "./api";

const props = defineProps<{
    instance: DepositNativeInstance;
    owner: string | null;
    summary: NativeSummary | null;
}>();

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

// What the contract would owe if nothing had ever been spent. The counters only ever grow, and
// managerWithdraw does not touch totalWithdrawn, so this is the deposit side alone.
const grossLiability = computed(() => info.value ? info.value.totalDeposited - info.value.totalWithdrawn : null);

const spentInGame = computed(() => props.summary ? spentInGameAll(props.summary) : null);

// The gross figure comes from the chain and the spend from the database. Taking the base on-chain
// matters: the database mirror only advances when a user logs in or the reconciler runs, so using it
// as the base would understate what is still owed and overstate what is safe to take.
const liability = computed(() =>
    grossLiability.value !== null && spentInGame.value !== null ? grossLiability.value - spentInGame.value : null,
);

// Whatever is missing from the balance was taken by managerWithdraw (or rescueNative, which is
// equally invisible to the counters). Neither touches totalWithdrawn, so no bookkeeping is needed.
const managerWithdrawn = computed(() =>
    info.value && grossLiability.value !== null ? grossLiability.value - info.value.balance : null,
);

const withdrawable = computed(() =>
    info.value && liability.value !== null ? info.value.balance - liability.value : null,
);

const belowLiability = computed(() => !!info.value && liability.value !== null && info.value.balance < liability.value);

function setMax() {
    if (withdrawable.value !== null && withdrawable.value > 0n) amount.value = formatEther(withdrawable.value);
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
            <div v-if="spentInGame !== null">
                Đã tiêu trong game: <span class="mono">{{ formatEther(spentInGame) }} {{ instance.nativeSymbol }}</span>
            </div>
            <div v-if="liability !== null" class="strong">
                Nợ user thật: <span class="mono">{{ formatEther(liability) }} {{ instance.nativeSymbol }}</span>
            </div>
            <div v-if="managerWithdrawn !== null">
                Manager đã rút: <span class="mono">{{ formatEther(managerWithdrawn) }} {{ instance.nativeSymbol }}</span>
            </div>
            <div v-if="withdrawable !== null" class="strong">
                Rút an toàn: <span class="mono">{{ formatEther(withdrawable) }} {{ instance.nativeSymbol }}</span>
            </div>
        </div>

        <div v-if="spentInGame === null" class="warn">
            Chưa có số liệu tiêu xài trong game — đăng nhập ở trên để biết rút bao nhiêu là an toàn.
            Trong lúc đó phải nhập tay số lượng; <span class="mono">totalDeposited - totalWithdrawn</span>
            KHÔNG phải số còn nợ user, vì phần user đã tiêu không hề làm giảm hai counter đó.
        </div>

        <div v-if="belowLiability" class="warn">
            ⚠️ Balance đang THẤP HƠN số còn nợ user — rút bất kỳ số nào cũng động vào tiền deposit của
            người dùng, không phải phần dư. Contract không chặn việc này (managerWithdraw không kiểm
            tra liability).
        </div>

        <div class="row">
            <input v-model="to" type="text" class="addr" placeholder="Địa chỉ nhận" :disabled="busy || !owner"/>
            <input v-model="amount" type="text" inputmode="decimal" class="amt" :placeholder="`Số ${instance.nativeSymbol}`" :disabled="busy || !owner"/>
            <button
                class="btn max" :disabled="busy || withdrawable === null || withdrawable <= 0n"
                title="Điền số rút an toàn (balance trừ đi phần còn nợ user)"
                @click="setMax"
            >AN TOÀN</button>
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

.strong {
    color: var(--text);
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
