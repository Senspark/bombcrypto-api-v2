<script setup lang="ts">
import type {Chain} from "../types";

// Chain shown as a colored chip instead of plain text: amber = BSC, purple = POLYGON.
defineProps<{chain: Chain}>();
</script>

<template>
    <span class="chip" :class="chain === 'BSC' ? 'chip-bsc' : 'chip-polygon'">{{ chain }}</span>
</template>
