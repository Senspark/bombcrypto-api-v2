<script setup lang="ts">
// Pull the accumulated USDT out. Unlike the other treasury tabs there is no sweep-everything call —
// withdrawUnstakeFeeV2 takes an explicit amount and decrements the ledger, so the cap here is the
// smaller of the balance and the ledger. A larger amount underflows and reverts.
import {computed, ref, watch} from "vue";
import {formatUnits} from "ethers";
import {CHAINS, type HeroStakeInstance} from "./config";
import {readHeroStakeUsdt, withdrawHeroStakeFee} from "./treasury";

const props = defineProps<{instance: HeroStakeInstance; usdtAddress: string; owner: string | null}>();

const balance = ref<bigint>(0n);
const ledger = ref<bigint>(0n);
const decimals = ref(6);
const busy = ref(false);
const txHash = ref("");
const err = ref("");

async function load() {
    if (!props.instance.distributes) return;
    const r = await readHeroStakeUsdt(props.instance, props.usdtAddress);
    balance.value = r.balance;
    ledger.value = r.ledger;
    decimals.value = r.decimals;
}

watch(() => props.owner, () => void load().catch(() => {}), {immediate: true});

defineExpose({load}); // parent refreshes this after a distribution adds USDT

const withdrawable = computed(() => (balance.value < ledger.value ? balance.value : ledger.value));

async function onWithdraw() {
    if (!props.owner) return;
    err.value = "";
    txHash.value = "";
    busy.value = true;
    try {
        txHash.value = await withdrawHeroStakeFee(props.instance, props.usdtAddress, props.owner, withdrawable.value);
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
        <h2>Treasury USDT</h2>
        <div v-if="!instance.distributes" class="muted bal">Chain chưa upgrade.</div>
        <template v-else>
            <div class="muted bal">
                Trong contract: <span class="mono">{{ formatUnits(balance, decimals) }} USDT</span>
                <span class="sep">·</span>
                sổ phí: <span class="mono">{{ formatUnits(ledger, decimals) }}</span>
            </div>
            <div v-if="balance > ledger" class="muted note">
                Số dư lớn hơn sổ — phần chênh chưa được ghi có nên rút không được. Chỉ rút tối đa bằng sổ.
            </div>
            <div class="row">
                <button
                    class="btn" :disabled="busy || !owner || withdrawable === 0n"
                    @click="onWithdraw"
                >{{ busy ? "..." : `Rút ${formatUnits(withdrawable, decimals)} USDT về ví` }}</button>
            </div>
        </template>
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

.sep {
    margin: 0 6px;
}

.note {
    font-size: 13px;
    margin-bottom: 10px;
}

.row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}
</style>
