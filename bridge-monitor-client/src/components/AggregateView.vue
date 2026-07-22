<script setup lang="ts">
import {computed, onMounted} from "vue";
import {api} from "../api";
import {formatWei, shortAddr, snapshotNote} from "../format";
import {addressUrl} from "../explorers";
import {useAsync} from "../useAsync";
import {usePoll, POLL_MS} from "../usePoll";
import CopyBtn from "./CopyBtn.vue";
import ChainBadge from "./ChainBadge.vue";
import TokenIcon from "./TokenIcon.vue";
import FundButton from "./FundButton.vue";
import EnableToggle from "./EnableToggle.vue";
import type {CrossChainCell} from "../types";

const {data, loading, error, run} = useAsync((force = false) => api.aggregate(force));
onMounted(() => run()); // initial load serves the cached snapshot; Refresh forces a chain re-read
// Poll the cached (non-force) aggregate: unchanged cells stay cached, only the ones the sweep invalidated re-read.
usePoll(() => run(), POLL_MS);

// Cross-chain rows whose on-chain liquidity can't cover the net payout they still owe.
const lowLiquidity = computed<CrossChainCell[]>(() => (data.value?.crossChain ?? []).filter((x) => !x.liquidityOk));

function shortfall(x: CrossChainCell): string {
    return formatWei((BigInt(x.requiredNet) - BigInt(x.liquidity)).toString());
}

// Over-withdraw (invariant breach) is the worst; then insufficient liquidity; else fine.
function ccStatus(x: CrossChainCell): {label: string; cls: string} {
    if (!x.ok) return {label: "VI PHẠM", cls: "bad"};
    if (!x.liquidityOk) return {label: "THIẾU TK", cls: "warn"};
    return {label: "OK", cls: "ok"};
}
</script>

<template>
    <div class="toolbar">
        <button class="btn" :disabled="loading" @click="run(true)">{{ loading ? "Đang tải…" : "Refresh" }}</button>
        <span class="muted">Đọc từ cache; bấm Refresh để đọc lại on-chain.</span>
        <span v-if="data" class="muted">· {{ snapshotNote(data.fetchedAt, data.cached) }}</span>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <p v-if="data && lowLiquidity.length" class="error">
        <strong>Thiếu thanh khoản để trả nợ:</strong>
        <template v-for="(x, i) in lowLiquidity" :key="i">
            <ChainBadge :chain="x.withdrawChain"/> <TokenIcon :symbol="x.symbol" :size="14"/> thiếu {{ shortfall(x) }}<span v-if="i < lowLiquidity.length - 1"> · </span>
        </template>
    </p>

    <template v-if="data">
        <h3 class="section">Cân đối nội bộ theo chain</h3>
        <p class="muted" style="margin: -4px 0 12px; font-size: 13px">
            Deposit / Withdraw ở đây là counter CÙNG chain (phục vụ kiểm tra thanh khoản:
            Deposit − Withdraw + Phí đã thu + Fund = Thanh khoản), KHÔNG phải cặp đối ứng — đừng trừ hai số này
            để suy "còn Withdraw được". Cặp Deposit-Withdraw theo hướng + Nợ xem bảng "Chéo chain" bên dưới.
        </p>

        <div v-for="c in data.chains" :key="c.chain" class="card">
            <div class="card-head">
                <h2>
                    <ChainBadge :chain="c.chain"/> <span class="muted">#{{ c.chainId }}</span>
                </h2>
                <a :href="addressUrl(c.chainId, c.bridgeAddress)" target="_blank" rel="noreferrer" class="mono" :title="c.bridgeAddress">
                    {{ shortAddr(c.bridgeAddress) }}
                </a>
                <CopyBtn :value="c.bridgeAddress"/>
                <EnableToggle
                    :chain-id="c.chainId" :bridge-address="c.bridgeAddress"
                    flag="deposit" :enabled="c.depositEnabled" @changed="run(true)"
                />
                <EnableToggle
                    :chain-id="c.chainId" :bridge-address="c.bridgeAddress"
                    flag="withdraw" :enabled="c.withdrawEnabled" @changed="run(true)"
                />
                <span class="badge muted">phí {{ c.feePercent }}%</span>
            </div>
            <div class="table-wrap">
                <table>
                    <thead>
                    <tr>
                        <th>Token</th>
                        <th class="num">Thanh khoản</th>
                        <th class="num">Đã Deposit</th>
                        <th class="num">Đã Withdraw</th>
                        <th class="num">Phí đã thu</th>
                        <th class="num">Phí đã rút</th>
                        <th class="num">Đã Fund</th>
                        <th>Cân đối</th>
                        <th>Fund</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr v-for="t in c.tokens" :key="t.symbol">
                        <td><TokenIcon :symbol="t.symbol"/></td>
                        <td class="num">{{ formatWei(t.liquidity) }}</td>
                        <td class="num">{{ formatWei(t.totalDeposited) }}</td>
                        <td class="num">{{ formatWei(t.totalWithdrawn) }}</td>
                        <td class="num">{{ formatWei(t.collectedFees) }}</td>
                        <td class="num">{{ formatWei(t.sweptFees) }}</td>
                        <td class="num">{{ formatWei(t.totalFunded) }}</td>
                        <td>
                            <span class="badge" :class="t.solvency.ok ? 'ok' : 'bad'">{{ t.solvency.ok ? "OK" : "LỆCH" }}</span>
                            <span v-if="!t.solvency.ok" class="muted mono">
                                kỳ vọng {{ formatWei(t.solvency.expected) }}
                            </span>
                        </td>
                        <td>
                            <FundButton
                                :chain-id="c.chainId"
                                :bridge-address="c.bridgeAddress"
                                :token-address="t.token"
                                :symbol="t.symbol"
                                @funded="run(true)"
                            />
                        </td>
                    </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="card">
            <div class="card-head">
                <h2>Chéo chain — nợ &amp; thanh khoản</h2>
                <span class="muted">nợ của chain Withdraw = đã Deposit ở chain đối diện − đã Withdraw; thanh khoản phải đủ trả phần net</span>
            </div>
            <div class="table-wrap">
                <table>
                    <thead>
                    <tr>
                        <th>Token</th>
                        <th>Chain Withdraw</th>
                        <th class="num">Đã Withdraw</th>
                        <th>Chain Deposit</th>
                        <th class="num">Đã Deposit (đối diện)</th>
                        <th class="num">Nợ (còn phải trả)</th>
                        <th class="num">Thanh khoản</th>
                        <th>Trạng thái</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr v-for="(x, i) in data.crossChain" :key="i">
                        <td><TokenIcon :symbol="x.symbol"/></td>
                        <td><ChainBadge :chain="x.withdrawChain"/></td>
                        <td class="num">{{ formatWei(x.totalWithdrawn) }}</td>
                        <td><ChainBadge :chain="x.depositChain"/></td>
                        <td class="num">{{ formatWei(x.oppositeDeposited) }}</td>
                        <td class="num" :title="`Cần chi sau phí: ${formatWei(x.requiredNet)}`">{{ formatWei(x.outstanding) }}</td>
                        <td class="num" :class="x.liquidityOk ? '' : 'warn'">{{ formatWei(x.liquidity) }}</td>
                        <td><span class="badge" :class="ccStatus(x).cls">{{ ccStatus(x).label }}</span></td>
                    </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </template>
</template>
