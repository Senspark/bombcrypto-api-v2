<script setup lang="ts">
import type {TokenSym} from "../types";

// Token logo in place of the BCOIN/SEN text label. Images live in public/tokens/<symbol>.png; the symbol is
// kept as alt/title so it's still identifiable on hover and for screen readers.
const props = defineProps<{symbol: TokenSym; size?: number}>();
</script>

<template>
    <img class="tok" :src="`/tokens/${symbol}.png`" :alt="symbol" :title="symbol"
         :width="size ?? 18" :height="size ?? 18"/>
</template>
