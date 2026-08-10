<script setup lang="ts">
import {onMounted, ref} from "vue";
import {api, UnauthorizedError} from "./api";

const GOOGLE_CLIENT_ID =
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    "958579510793-0splgd1oggo7tijl851a9dc8htjbupdk.apps.googleusercontent.com";

const emit = defineEmits<{(e: "authenticated", email: string): void}>();

const checking = ref(true);
const err = ref("");
const buttonHost = ref<HTMLDivElement | null>(null);

onMounted(async () => {
    try {
        const {email} = await api.me();
        checking.value = false;
        emit("authenticated", email);
        return;
    } catch (e) {
        checking.value = false;
        if (!(e instanceof UnauthorizedError)) {
            err.value = e instanceof Error ? e.message : String(e);
            return;
        }
    }
    await renderGoogleButton();
});

async function renderGoogleButton() {
    try {
        await loadGsi();
    } catch {
        err.value = "Không tải được Google Sign-In. Kiểm tra kết nối mạng.";
        return;
    }
    const google = (window as any).google;
    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: {credential: string}) => {
            err.value = "";
            try {
                const {email} = await api.login(response.credential);
                emit("authenticated", email);
            } catch (e) {
                err.value = e instanceof Error ? e.message : String(e);
            }
        },
    });
    if (buttonHost.value) {
        google.accounts.id.renderButton(buttonHost.value, {theme: "filled_black", size: "large"});
    }
}

function loadGsi(): Promise<void> {
    if ((window as any).google?.accounts?.id) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("gsi load failed"));
        document.head.appendChild(script);
    });
}
</script>

<template>
    <div class="card gate">
        <h2>Đăng nhập</h2>
        <p v-if="checking" class="muted">Đang kiểm tra phiên...</p>
        <template v-else>
            <p class="muted">Chỉ tài khoản @senspark.com mới dùng được tab này.</p>
            <div ref="buttonHost" class="btn-host"></div>
        </template>
        <div v-if="err" class="error">{{ err }}</div>
    </div>
</template>

<style scoped>
.gate {
    max-width: 420px;
    margin: 40px auto;
    text-align: center;
}
.btn-host {
    display: flex;
    justify-content: center;
    margin-top: 12px;
}
</style>
