<script setup lang="ts">
// One tab for the four treasuries the splitter pays into. Dev is the only one that swaps and keeps
// its own module; the other three are read off the splitter so the UI cannot point at a treasury
// that setTreasuries has since replaced.
import {computed, ref, watch} from "vue";
import {BSC_CHAIN_ID, CHAINS, SPLITTERS} from "./config";
import {readTreasuryAddresses, type TreasuryAddresses} from "./treasury";
import {walletAccount} from "../treasury/wallet";
import WalletToolbar from "../treasury/WalletToolbar.vue";
import HoldingPanel from "./HoldingPanel.vue";
import CommunityPanel from "./CommunityPanel.vue";
import DevSwapCard from "../devTreasury/DevSwapCard.vue";
import WithdrawDevPanel from "../devTreasury/WithdrawDevPanel.vue";
import {DEV_TREASURIES, routesFor} from "../devTreasury/config";

const SUBS = [
    {key: "dev", label: "Treasury Dev"},
    {key: "marketing", label: "Treasury Marketing"},
    {key: "burn", label: "Treasury Burn"},
    {key: "community", label: "Treasury Community"},
] as const;

const sub = ref<string>("dev");
const addresses = ref<Record<string, TreasuryAddresses>>({});
const err = ref("");
const devPanels = ref<Record<string, InstanceType<typeof WithdrawDevPanel> | null>>({});

// BSC first, matching every other treasury tab's column order.
const chains = computed(() => [...SPLITTERS].sort((a) => (a.chainId === BSC_CHAIN_ID ? -1 : 1)));
const devInstances = computed(() =>
    [...DEV_TREASURIES].sort((a) => (a.chainId === BSC_CHAIN_ID ? -1 : 1)).filter((d) => d.address),
);

async function load() {
    err.value = "";
    try {
        const entries = await Promise.all(
            SPLITTERS.map(async (s) => [s.id, await readTreasuryAddresses(s)] as const),
        );
        addresses.value = Object.fromEntries(entries);
    } catch (e) {
        err.value = e instanceof Error ? e.message : String(e);
    }
}

watch(() => walletAccount.value, () => void load(), {immediate: true});
</script>

<template>
    <WalletToolbar/>

    <p class="muted">
        Bốn treasury nhận tiền từ splitter. Dev giữ phần dev và tự swap sang USDT; marketing và burn
        chỉ giữ token, burn thì đốt thật bằng <span class="mono">burn()</span> của chính token nên
        total supply giảm; community là <span class="mono">MasterRewardPool</span>, rút bằng
        <span class="mono">adminWithdraw</span> và đẩy sang child pool theo hạn mức từng token.
        Địa chỉ đọc thẳng từ splitter, không hardcode.
    </p>

    <div class="subtabs">
        <button
            v-for="s in SUBS" :key="s.key" class="subtab" :class="{active: sub === s.key}"
            @click="sub = s.key"
        >{{ s.label }}</button>
    </div>

    <div v-if="err" class="error">{{ err }}</div>

    <div v-if="sub === 'dev'" class="chain-grid">
        <div
            v-for="instance in devInstances" :key="instance.id" class="chain-col"
            :class="instance.chainId === BSC_CHAIN_ID ? 'chain-col-bsc' : 'chain-col-polygon'"
        >
            <h3 class="chain-title">
                <span class="chip" :class="instance.chainId === BSC_CHAIN_ID ? 'chip-bsc' : 'chip-polygon'">{{ CHAINS[instance.chainId].name }}</span>
            </h3>
            <DevSwapCard
                v-for="r in routesFor(instance)" :key="r.id"
                :instance="instance" :route="r" :owner="walletAccount"
                @swapped="devPanels[instance.id]?.load()"
            />
            <WithdrawDevPanel
                :ref="(el) => (devPanels[instance.id] = el as any)"
                :instance="instance" :usdt-address="routesFor(instance)[0].tokenOut" :owner="walletAccount"
            />
        </div>
    </div>

    <!-- Community stacks one chain per row: the pool has withdraw, per-token limit and child-pool
         controls, which do not fit two to a screen. The other three keep the shared column layout. -->
    <div v-else :class="sub === 'community' ? 'chain-stack' : 'chain-grid'">
        <div
            v-for="c in chains" :key="c.id" class="chain-col"
            :class="c.chainId === BSC_CHAIN_ID ? 'chain-col-bsc' : 'chain-col-polygon'"
        >
            <template v-if="addresses[c.id]">
                <CommunityPanel
                    v-if="sub === 'community'"
                    :chain-id="c.chainId" :pool="addresses[c.id].community" :owner="walletAccount"
                />
                <HoldingPanel
                    v-else
                    :chain-id="c.chainId"
                    :treasury="sub === 'burn' ? addresses[c.id].burn : addresses[c.id].marketing"
                    :owner="walletAccount" :mode="sub === 'burn' ? 'burn' : 'marketing'"
                />
            </template>
        </div>
    </div>
</template>

<style scoped>
.chain-stack {
    display: flex;
    flex-direction: column;
    gap: 18px;
}

.subtabs {
    display: flex;
    gap: 8px;
    margin: 14px 0 18px;
    flex-wrap: wrap;
}

.subtab {
    background: var(--panel-2);
    border: 1px solid var(--border, #333);
    color: inherit;
    padding: 6px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
}

.subtab.active {
    background: var(--accent, #3b82f6);
    color: #fff;
}
</style>
