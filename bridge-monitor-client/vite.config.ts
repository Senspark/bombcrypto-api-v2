import {defineConfig, loadEnv} from "vite";
import vue from "@vitejs/plugin-vue";

// Localhost-only dev server. All /monitor calls proxy to the ap-deposit-bridge REST layer (host 8108 in its
// compose), so the browser stays same-origin and no CORS/admin-key is involved. Override the target with
// VITE_MONITOR_TARGET when the signer service runs elsewhere.
export default defineConfig(({mode}) => {
    const env = loadEnv(mode, process.cwd(), "");
    const target = env.VITE_MONITOR_TARGET || "http://localhost:8108";
    return {
        // Relative asset URLs so the build runs under any path (bucket subpath, domain root) without a rebuild.
        // Safe here because routing is hash-based (#wallets) — index.html never moves out of its own directory.
        base: "./",
        plugins: [vue()],
        server: {
            port: 8200,
            proxy: {
                "/monitor": {target, changeOrigin: true},
            },
        },
    };
});
