import {ref, type Ref} from "vue";

// Minimal fetch-state helper: data/loading/error + a run() to (re)load. run() forwards its args to the loader
// (e.g. run(true) to force a cache-bypassing refresh). Every view owns its own instance.
export function useAsync<T>(fn: (...args: any[]) => Promise<T>) {
    const data = ref<T | null>(null) as Ref<T | null>;
    const loading = ref(false);
    const error = ref<string | null>(null);

    async function run(...args: any[]): Promise<void> {
        loading.value = true;
        error.value = null;
        try {
            data.value = await fn(...args);
        } catch (e) {
            error.value = e instanceof Error ? e.message : String(e);
        } finally {
            loading.value = false;
        }
    }

    return {data, loading, error, run};
}
