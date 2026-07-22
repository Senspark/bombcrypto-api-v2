import {onMounted, onUnmounted} from "vue";

// Auto-refresh helper: calls `fn` every `ms` while the view is mounted, and clears the timer on unmount (views
// are torn down by the App.vue v-if when you switch tabs, so this prevents dangling timers). Skips a tick when
// the tab is hidden — no point polling an off-screen page, and it keeps the RPC/DB load off when nobody's
// looking. Does NOT fire immediately; the view's onMounted load already did the first fetch.
export function usePoll(fn: () => void, ms: number): void {
    let timer: number | undefined;
    onMounted(() => {
        timer = window.setInterval(() => {
            if (!document.hidden) fn();
        }, ms);
    });
    onUnmounted(() => {
        if (timer !== undefined) window.clearInterval(timer);
    });
}

// Shared default cadence — the sweep catches a change within its active window (~seconds), so a 10s poll shows
// it promptly while a plain poll (no ?refresh) only pays RPC for the cells the sweep invalidated.
export const POLL_MS = 10_000;
