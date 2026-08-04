<script setup lang="ts">
import {computed, ref, watch} from "vue";
import {formatUnits} from "ethers";
import {CHAINS, type SwapRoute} from "./config";
import {quote, readTreasury, swapFees} from "./treasury";
import type {Quote, TreasuryInfo} from "./types";

const props = defineProps<{route: SwapRoute; owner: string | null}>();
const emit = defineEmits<{(e: "swapped"): void}>();

const info = ref<TreasuryInfo | null>(null);
const amount = ref("");
const slippagePct = ref("1");
const q = ref<Quote | null>(null);
const busy = ref(false);
const status = ref("");
const txHash = ref("");
const err = ref("");

async function loadInfo() {
    info.value = await readTreasury(props.route);
}

watch(() => props.owner, () => void loadInfo().catch(() => {}), {immediate: true});

const ready = computed(() => info.value?.usdtConfigured && info.value?.routerAllowed);

function slippageBps(): number {
    const pct = parseFloat(slippagePct.value);
    if (isNaN(pct) || pct < 0) return 100;
    return Math.round(pct * 100);
}

function setMax() {
    if (info.value) amount.value = formatUnits(info.value.fees, info.value.decimalsIn);
}

async function onQuote() {
    err.value = "";
    q.value = null;
    txHash.value = "";
    status.value = "";
    busy.value = true;
    try {
        q.value = await quote(props.route, amount.value.trim(), slippageBps());
    } catch (e) {
        err.value = e instanceof Error ? e.message : String(e);
    } finally {
        busy.value = false;
    }
}

async function onSwap() {
    err.value = "";
    txHash.value = "";
    status.value = "Đang swap qua contract...";
    busy.value = true;
    try {
        txHash.value = await swapFees(props.route, amount.value.trim(), slippageBps());
        status.value = "Swap xong — USDT đã về contract";
        q.value = null;
        amount.value = "";
        await loadInfo().catch(() => {});
        emit("swapped");
    } catch (e) {
        status.value = "";
        err.value = e instanceof Error ? e.message : String(e);
    } finally {
        busy.value = false;
    }
}

function fmt(v: bigint, d: number): string {
    return formatUnits(v, d);
}
</script>

<template>
    <div class="card">
        <h2>{{ route.label }}</h2>

        <div v-if="info" class="muted fees">
            Fee đang có:
            <span class="mono">{{ fmt(info.fees, info.decimalsIn) }} {{ route.tokenInSymbol }}</span>
        </div>

        <div v-if="info && !ready" class="warn">
            Chưa cấu hình on-chain:
            <template v-if="!info.usdtConfigured">usdtToken chưa set. </template>
            <template v-if="!info.routerAllowed">router chưa whitelist. </template>
            Chạy <span class="mono">set-deposit-bridge-swap.js</span> trước.
        </div>

        <div class="row">
            <input
                v-model="amount" type="text" inputmode="decimal"
                :placeholder="`Số ${route.tokenInSymbol}`" :disabled="busy || !owner || !ready"
                @keyup.enter="onQuote"
            />
            <button class="btn max" :disabled="busy || !info || info.fees === 0n" @click="setMax">MAX</button>
            <label class="muted">Slippage %
                <input v-model="slippagePct" type="text" inputmode="decimal" class="slip" :disabled="busy"/>
            </label>
            <button class="btn" :disabled="busy || !owner || !ready || !amount.trim()" @click="onQuote">Báo giá</button>
        </div>

        <div v-if="q" class="quote">
            <table>
                <tbody>
                    <tr v-if="q.routeLabel">
                        <td class="muted">Route</td>
                        <td class="num mono">{{ q.routeLabel }}</td>
                    </tr>
                    <tr>
                        <td class="muted">Swap</td>
                        <td class="num mono">{{ fmt(q.amountIn, q.decimalsIn) }} {{ route.tokenInSymbol }}</td>
                    </tr>
                    <tr>
                        <td class="muted">Dự kiến nhận</td>
                        <td class="num mono">{{ fmt(q.expectedOut, q.decimalsOut) }} {{ route.tokenOutSymbol }}</td>
                    </tr>
                    <tr>
                        <td class="muted">Tối thiểu ({{ (q.slippageBps / 100).toFixed(2) }}%)</td>
                        <td class="num mono">{{ fmt(q.minOut, q.decimalsOut) }} {{ route.tokenOutSymbol }}</td>
                    </tr>
                </tbody>
            </table>
            <button class="btn" :disabled="busy" @click="onSwap">{{ busy ? "..." : "Swap fee -> USDT (contract)" }}</button>
        </div>

        <div v-if="status" class="muted stat">{{ status }}</div>
        <a
            v-if="txHash" :href="CHAINS[route.chainId].explorerTx + txHash"
            target="_blank" rel="noreferrer" class="mono"
        >xem tx</a>
        <div v-if="err" class="error">{{ err }}</div>
    </div>
</template>

<style scoped>
.fees {
    margin-bottom: 10px;
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

.row input[type="text"] {
    width: 160px;
}

.max {
    padding: 6px 10px;
}

.slip {
    width: 60px;
    margin-left: 6px;
}

.quote {
    margin-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
}

.stat {
    margin-top: 8px;
}
</style>
