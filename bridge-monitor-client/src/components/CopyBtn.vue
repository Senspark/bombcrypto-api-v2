<script setup lang="ts">
import {ref} from "vue";

// Tiny click-to-copy button placed next to an ellipsized address/tx/wallet so the FULL value is recoverable.
// The displayed text stays shortened (shortAddr); this copies the untruncated string to the clipboard.
const props = defineProps<{value: string | null | undefined}>();
const copied = ref(false);

async function copy(): Promise<void> {
    const v = props.value;
    if (!v) return;
    try {
        await navigator.clipboard.writeText(v);
    } catch {
        // navigator.clipboard needs a secure context; fall back to a hidden textarea + execCommand.
        const ta = document.createElement("textarea");
        ta.value = v;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand("copy");
        } catch {
            /* nothing more we can do */
        }
        document.body.removeChild(ta);
    }
    copied.value = true;
    window.setTimeout(() => (copied.value = false), 1200);
}
</script>

<template>
    <!-- @click.stop so copying never triggers a parent action (e.g. the wallet drill-in button). -->
    <button
        v-if="value"
        type="button"
        class="copybtn"
        :class="{copied}"
        :title="copied ? 'Đã copy' : `Copy: ${value}`"
        @click.stop.prevent="copy"
    >
        <svg v-if="copied" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
    </button>
</template>
