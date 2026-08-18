<script setup lang="ts">
// Marketing and Burn are the same contract with different jobs, so they share this panel: one row
// per token with the balance and the one action that treasury is for. Burn destroys, marketing pays
// out to a wallet — the difference is the mode prop, not a second copy of the file.
import {ref, watch} from "vue";
import {formatUnits, parseUnits} from "ethers";
import {BSC_CHAIN_ID, CHAINS} from "./config";
import {burnFromTreasury, readBalances, withdrawFromTreasury, type TokenBalance} from "./treasury";
import {shortAddr} from "../format";

const props = defineProps<{
    chainId: number;
    treasury: string;
    owner: string | null;
    mode: "marketing" | "burn";
}>();

const rows = ref<TokenBalance[]>([]);
const amounts = ref<Record<string, string>>({});
const receiver = ref("");
const busy = ref("");
const txHash = ref("");
const err = ref("");

async function load() {
    rows.value = await readBalances(props.chainId, props.treasury);
}

watch(
    () => [props.owner, props.treasury],
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

async function run(row: TokenBalance) {
    err.value = "";
    txHash.value = "";
    busy.value = row.address;
    try {
        const value = parseUnits((amounts.value[row.address] ?? "").trim(), row.decimals);
        if (value <= 0n) throw new Error("Số lượng phải > 0");
        if (value > row.balance) throw new Error(`Vượt số dư ${row.symbol}`);
        txHash.value =
            props.mode === "burn"
                ? await burnFromTreasury(props.chainId, props.treasury, row.address, value)
                : await withdrawFromTreasury(props.chainId, props.treasury, row.address, receiver.value.trim(), value);
        amounts.value[row.address] = "";
        await load().catch(() => {});
    } catch (e) {
        err.value = e instanceof Error ? e.message : String(e);
    } finally {
        busy.value = "";
    }
}
</script>

<template>
    <div class="card">
        <h3 class="head">
            <span class="chip" :class="chainId === BSC_CHAIN_ID ? 'chip-bsc' : 'chip-polygon'">{{ CHAINS[chainId].name }}</span>
            <a class="mono" :href="CHAINS[chainId].explorerAddress + treasury" target="_blank" rel="noreferrer">{{ shortAddr(treasury) }}</a>
        </h3>

        <div v-if="mode === 'marketing'" class="row rcv">
            <label class="muted">Ví nhận</label>
            <input v-model="receiver" type="text" class="addr" placeholder="0x..." :disabled="!!busy"/>
        </div>

        <table class="rows">
            <tbody>
                <tr v-for="row in rows" :key="row.address">
                    <td class="muted sym">{{ row.symbol }}</td>
                    <td class="num mono">{{ formatUnits(row.balance, row.decimals) }}</td>
                    <td v-if="mode === 'burn' && !row.burnable" class="muted note">token không có burn(), chỉ rút được bằng script</td>
                    <template v-else>
                        <td>
                            <input
                                v-model="amounts[row.address]" type="text" inputmode="decimal"
                                :placeholder="`Số ${row.symbol}`" :disabled="!!busy || !owner"
                            />
                        </td>
                        <td>
                            <button class="btn max" :disabled="!!busy || row.balance === 0n" @click="setMax(row)">MAX</button>
                        </td>
                        <td>
                            <button
                                class="btn" :disabled="!!busy || !owner || !(amounts[row.address] ?? '').trim()"
                                @click="run(row)"
                            >{{ busy === row.address ? "..." : mode === "burn" ? "Burn" : "Rút" }}</button>
                        </td>
                    </template>
                </tr>
            </tbody>
        </table>

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

.rows {
    width: 100%;
    font-size: 13px;
}

.rows td {
    padding: 4px 10px 4px 0;
}

.sym {
    width: 70px;
}

.rows input[type="text"] {
    width: 150px;
}

.row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.rcv {
    margin-bottom: 12px;
}

input.addr {
    width: 430px; /* fits a whole 0x address; input[type=text] above outranks a bare class */
}

.max {
    padding: 6px 10px;
}

.note {
    font-size: 12px;
}
</style>
