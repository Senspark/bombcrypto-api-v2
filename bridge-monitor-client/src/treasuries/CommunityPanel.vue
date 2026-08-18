<script setup lang="ts">
// The community share goes to a MasterRewardPool, which is a different contract from the other
// treasuries: it pays out with adminWithdraw, and it can push a fixed per-token amount to a child
// pool. Both are role-gated to the CEO wallet, so connecting with any other wallet reads fine and
// reverts on the buttons.
import {ref, watch} from "vue";
import {formatUnits, parseUnits} from "ethers";
import {BSC_CHAIN_ID, CHAINS} from "./config";
import {
    poolSetChild, poolSetLimit, poolTransferToChild, poolWithdraw, readBalances, readChildPool,
    type TokenBalance,
} from "./treasury";
import {shortAddr} from "../format";

const props = defineProps<{chainId: number; pool: string; owner: string | null}>();

const rows = ref<TokenBalance[]>([]);
const childPool = ref("");
const childInput = ref("");
const amounts = ref<Record<string, string>>({});
const limits = ref<Record<string, string>>({});
const receiver = ref("");
const busy = ref("");
const txHash = ref("");
const err = ref("");

async function load() {
    const [balances, child] = await Promise.all([
        readBalances(props.chainId, props.pool, true),
        readChildPool(props.chainId, props.pool),
    ]);
    rows.value = balances;
    childPool.value = child;
    if (!childInput.value) childInput.value = child;
}

watch(
    () => [props.owner, props.pool],
    () => {
        if (props.owner && !receiver.value) receiver.value = props.owner;
        void load().catch(() => {});
    },
    {immediate: true},
);

defineExpose({load});

function setMax(row: TokenBalance) {
    amounts.value[row.address] = formatUnits(row.balance, row.decimals);
}

async function act(key: string, fn: () => Promise<string>) {
    err.value = "";
    txHash.value = "";
    busy.value = key;
    try {
        txHash.value = await fn();
        await load().catch(() => {});
    } catch (e) {
        err.value = e instanceof Error ? e.message : String(e);
    } finally {
        busy.value = "";
    }
}

function onWithdraw(row: TokenBalance) {
    void act(`w:${row.address}`, async () => {
        const value = parseUnits((amounts.value[row.address] ?? "").trim(), row.decimals);
        if (value <= 0n) throw new Error("Số lượng phải > 0");
        if (value > row.balance) throw new Error(`Vượt số dư ${row.symbol}`);
        const hash = await poolWithdraw(props.chainId, props.pool, row.address, receiver.value.trim(), value);
        amounts.value[row.address] = "";
        return hash;
    });
}

function onSetLimit(row: TokenBalance) {
    void act(`l:${row.address}`, () =>
        poolSetLimit(props.chainId, props.pool, row.address, parseUnits((limits.value[row.address] ?? "").trim(), row.decimals)),
    );
}

function onTransfer(row: TokenBalance) {
    void act(`c:${row.address}`, () => poolTransferToChild(props.chainId, props.pool, row.address));
}

function onSetChild() {
    void act("child", () => poolSetChild(props.chainId, props.pool, childInput.value.trim()));
}
</script>

<template>
    <div class="card">
        <h3 class="head">
            <span class="chip" :class="chainId === BSC_CHAIN_ID ? 'chip-bsc' : 'chip-polygon'">{{ CHAINS[chainId].name }}</span>
            <a class="mono" :href="CHAINS[chainId].explorerAddress + pool" target="_blank" rel="noreferrer">{{ shortAddr(pool) }}</a>
        </h3>

        <div class="row rcv">
            <label class="muted">Ví nhận</label>
            <input v-model="receiver" type="text" class="addr" placeholder="0x..." :disabled="!!busy"/>
        </div>

        <!-- One block per token instead of one wide row: withdraw, limit and child-pool transfer are
             three separate actions and they do not fit on a line together. -->
        <div v-for="row in rows" :key="row.address" class="token">
            <div class="token-head">
                <span class="sym">{{ row.symbol }}</span>
                <span class="mono">{{ formatUnits(row.balance, row.decimals) }}</span>
            </div>

            <div class="row">
                <input
                    v-model="amounts[row.address]" type="text" inputmode="decimal"
                    :placeholder="`Số ${row.symbol}`" :disabled="!!busy || !owner"
                />
                <button class="btn max" :disabled="!!busy || row.balance === 0n" @click="setMax(row)">MAX</button>
                <button
                    class="btn" :disabled="!!busy || !owner || !(amounts[row.address] ?? '').trim()"
                    @click="onWithdraw(row)"
                >{{ busy === `w:${row.address}` ? "..." : "Rút" }}</button>
            </div>

            <div class="row limits">
                <span class="muted">Hạn mức child pool</span>
                <span class="mono">{{ row.limit === undefined ? "-" : formatUnits(row.limit, row.decimals) }}</span>
                <input
                    v-model="limits[row.address]" type="text" inputmode="decimal"
                    placeholder="Hạn mức mới" :disabled="!!busy || !owner"
                />
                <button
                    class="btn" :disabled="!!busy || !owner || !(limits[row.address] ?? '').trim()"
                    @click="onSetLimit(row)"
                >{{ busy === `l:${row.address}` ? "..." : "Đặt" }}</button>
                <button
                    class="btn" :disabled="!!busy || !owner || !row.limit"
                    @click="onTransfer(row)"
                >{{ busy === `c:${row.address}` ? "..." : "Chuyển sang child pool" }}</button>
            </div>
        </div>

        <div class="row child">
            <label class="muted">Child pool</label>
            <input v-model="childInput" type="text" class="addr" placeholder="0x..." :disabled="!!busy"/>
            <a
                v-if="childPool" class="mono" :href="CHAINS[chainId].explorerAddress + childPool"
                target="_blank" rel="noreferrer"
            >{{ shortAddr(childPool) }}</a>
            <button
                class="btn" :disabled="!!busy || !owner || !childInput.trim() || childInput.trim().toLowerCase() === childPool.toLowerCase()"
                @click="onSetChild"
            >{{ busy === "child" ? "..." : "Đổi child pool" }}</button>
        </div>

        <a
            v-if="txHash" :href="CHAINS[chainId].explorerTx + txHash"
            target="_blank" rel="noreferrer" class="mono"
        >xem tx</a>
        <div v-if="err" class="error">{{ err }}</div>
    </div>
</template>

<style scoped>
.head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 12px;
}

.token {
    border-top: 1px solid var(--border, #333);
    padding: 12px 0;
}

.token-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 8px;
    font-size: 13px;
}

.sym {
    font-weight: 600;
    min-width: 60px;
}

.row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    font-size: 13px;
}

.limits {
    margin-top: 8px;
}

.rcv {
    margin-bottom: 12px;
}

.child {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--border, #333);
}

input[type="text"] {
    width: 150px;
}

/* input.addr, not .addr: an attribute selector outranks a bare class, so the wallet and child-pool
   fields would otherwise be squeezed to 150px and truncate the address. */
input.addr {
    width: 430px; /* fits a whole 0x address without clipping the tail */
}

.max {
    padding: 6px 10px;
}
</style>
