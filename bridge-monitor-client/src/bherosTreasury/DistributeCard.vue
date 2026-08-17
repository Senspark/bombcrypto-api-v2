<script setup lang="ts">
// Four-leg distribution for a BHeroS instance already upgraded to withdrawToTreasury. Instances
// still on the old path keep BHeroSCard.vue; the tab picks between them on `instance.distributes`.
import {computed, ref, watch} from "vue";
import {formatUnits} from "ethers";
import {CHAINS, type BHeroSInstance, type SwapRoute} from "./config";
import {
    distributeBHeroSFees, quoteBHeroSDistribution, readBHeroSDistribution,
    type BHeroSDistributionInfo, type Legs,
} from "./treasury";
import {shortAddr} from "../format";
import {splitterBlockers} from "../treasury/splitter";
import type {Quote} from "../treasury/types";

const props = defineProps<{instance: BHeroSInstance; route: SwapRoute; owner: string | null}>();
const emit = defineEmits<{(e: "changed"): void}>();

const info = ref<BHeroSDistributionInfo | null>(null);
const amount = ref("");
const slippagePct = ref("1");
const legs = ref<Legs | null>(null);
const q = ref<Quote | null>(null);
const busy = ref(false);
const status = ref("");
const txHash = ref("");
const err = ref("");

async function loadInfo() {
    info.value = await readBHeroSDistribution(props.instance, props.route);
}

watch(() => props.owner, () => void loadInfo().catch(() => {}), {immediate: true});

const blockers = computed<string[]>(() =>
    info.value ? splitterBlockers(info.value.splitter, info.value, props.route.tokenOutSymbol) : [],
);
const ready = computed(() => info.value !== null && blockers.value.length === 0);
const split = computed(() => info.value?.split ?? null);

function slippageBps(): number {
    const pct = parseFloat(slippagePct.value);
    if (isNaN(pct) || pct < 0) return 100;
    return Math.round(pct * 100);
}

function setMax() {
    if (info.value) amount.value = formatUnits(info.value.fees, info.value.decimalsIn);
}

async function onPreview() {
    err.value = "";
    legs.value = null;
    q.value = null;
    txHash.value = "";
    status.value = "";
    if (!info.value || !split.value) return;
    busy.value = true;
    try {
        const r = await quoteBHeroSDistribution(props.route, amount.value.trim(), slippageBps(), split.value, info.value.decimalsIn);
        legs.value = r.legs;
        q.value = r.quote;
    } catch (e) {
        err.value = e instanceof Error ? e.message : String(e);
    } finally {
        busy.value = false;
    }
}

async function onDistribute() {
    if (!info.value || !split.value) return;
    err.value = "";
    txHash.value = "";
    status.value = "Đang chia về treasury...";
    busy.value = true;
    try {
        txHash.value = await distributeBHeroSFees(
            props.instance, props.route, amount.value.trim(), slippageBps(), split.value, info.value.decimalsIn,
        );
        status.value = "Xong — 3 treasury đã nhận, phần dev đã swap và ở lại contract";
        legs.value = null;
        q.value = null;
        amount.value = "";
        await loadInfo().catch(() => {});
        emit("changed");
    } catch (e) {
        status.value = "";
        err.value = e instanceof Error ? e.message : String(e);
    } finally {
        busy.value = false;
    }
}

function fmtIn(v: bigint): string {
    return formatUnits(v, info.value?.decimalsIn ?? 18);
}

function fmtOut(v: bigint): string {
    return formatUnits(v, info.value?.decimalsUsdt ?? 6);
}

function pct(bps: number): string {
    return (bps / 100).toFixed(2).replace(/\.00$/, "") + "%";
}

const explorerAddress = computed(() => CHAINS[props.instance.chainId].explorerAddress);
</script>

<template>
    <div class="card">
        <h2>{{ route.label }}</h2>

        <div v-if="info" class="muted fees">
            Fee đang có:
            <span class="mono">{{ fmtIn(info.fees) }} {{ route.tokenInSymbol }}</span>
            <span class="sep">·</span>
            {{ route.tokenOutSymbol }} trong contract:
            <span class="mono">{{ fmtOut(info.contractUsdt) }}</span>
        </div>

        <div v-if="blockers.length" class="warn">
            <div v-for="b in blockers" :key="b">{{ b }}</div>
        </div>

        <table v-if="info?.treasuries && info?.balances && split" class="conf">
            <tbody>
                <tr>
                    <td class="muted">Community {{ pct(split.communityBps) }}</td>
                    <td class="num mono">{{ fmtIn(info.balances.community) }}</td>
                    <td><a class="mono" :href="explorerAddress + info.treasuries.community" target="_blank" rel="noreferrer">{{ shortAddr(info.treasuries.community) }}</a></td>
                </tr>
                <tr>
                    <td class="muted">Marketing {{ pct(split.marketingBps) }}</td>
                    <td class="num mono">{{ fmtIn(info.balances.marketing) }}</td>
                    <td><a class="mono" :href="explorerAddress + info.treasuries.marketing" target="_blank" rel="noreferrer">{{ shortAddr(info.treasuries.marketing) }}</a></td>
                </tr>
                <tr>
                    <td class="muted">Burn {{ pct(split.burnBps) }}</td>
                    <td class="num mono">{{ fmtIn(info.balances.burn) }}</td>
                    <td><a class="mono" :href="explorerAddress + info.treasuries.burn" target="_blank" rel="noreferrer">{{ shortAddr(info.treasuries.burn) }}</a></td>
                </tr>
                <tr>
                    <td class="muted">Dev {{ pct(split.devBps) }}</td>
                    <td class="num mono">-</td>
                    <td class="muted">swap -&gt; {{ route.tokenOutSymbol }}, ở lại contract</td>
                </tr>
            </tbody>
        </table>

        <div class="row">
            <input
                v-model="amount" type="text" inputmode="decimal"
                :placeholder="`Số ${route.tokenInSymbol}`" :disabled="busy || !owner || !ready"
                @keyup.enter="onPreview"
            />
            <button class="btn max" :disabled="busy || !info || info.fees === 0n" @click="setMax">MAX</button>
            <label class="muted">Slippage %
                <input v-model="slippagePct" type="text" inputmode="decimal" class="slip" :disabled="busy"/>
            </label>
            <button class="btn" :disabled="busy || !owner || !ready || !amount.trim()" @click="onPreview">Xem trước</button>
        </div>

        <div v-if="legs && split" class="quote">
            <table>
                <tbody>
                    <tr>
                        <td class="muted">Community {{ pct(split.communityBps) }}</td>
                        <td class="num mono">{{ fmtIn(legs.community) }} {{ route.tokenInSymbol }}</td>
                    </tr>
                    <tr>
                        <td class="muted">Marketing {{ pct(split.marketingBps) }}</td>
                        <td class="num mono">{{ fmtIn(legs.marketing) }} {{ route.tokenInSymbol }}</td>
                    </tr>
                    <tr>
                        <td class="muted">Burn {{ pct(split.burnBps) }}</td>
                        <td class="num mono">{{ fmtIn(legs.burn) }} {{ route.tokenInSymbol }}</td>
                    </tr>
                    <tr>
                        <td class="muted">Dev {{ pct(split.devBps) }} (swap)</td>
                        <td class="num mono">{{ fmtIn(legs.dev) }} {{ route.tokenInSymbol }}</td>
                    </tr>
                    <template v-if="q">
                        <tr v-if="q.routeLabel">
                            <td class="muted">Route</td>
                            <td class="num mono">{{ q.routeLabel }}</td>
                        </tr>
                        <tr>
                            <td class="muted">Dev dự kiến nhận</td>
                            <td class="num mono">{{ fmtOut(q.expectedOut) }} {{ route.tokenOutSymbol }}</td>
                        </tr>
                        <tr>
                            <td class="muted">Dev tối thiểu ({{ (q.slippageBps / 100).toFixed(2) }}%)</td>
                            <td class="num mono">{{ fmtOut(q.minOut) }} {{ route.tokenOutSymbol }}</td>
                        </tr>
                    </template>
                    <tr v-else>
                        <td class="muted">Swap</td>
                        <td class="num muted">devBps = 0, không swap</td>
                    </tr>
                </tbody>
            </table>
            <button class="btn" :disabled="busy" @click="onDistribute">
                {{ busy ? "..." : "Chia về treasury (contract)" }}
            </button>
        </div>

        <div v-if="status" class="muted stat">{{ status }}</div>
        <a
            v-if="txHash" :href="CHAINS[instance.chainId].explorerTx + txHash"
            target="_blank" rel="noreferrer" class="mono"
        >xem tx</a>
        <div v-if="err" class="error">{{ err }}</div>
    </div>
</template>

<style scoped>
.fees {
    margin-bottom: 10px;
}

.sep {
    margin: 0 6px;
}

.warn {
    color: var(--warn, #f5a623);
    margin-bottom: 12px;
    font-size: 13px;
}

.conf {
    margin-bottom: 12px;
    font-size: 13px;
}

.conf td {
    padding-right: 12px;
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
