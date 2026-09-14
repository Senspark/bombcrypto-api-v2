<script setup lang="ts">
import {ref, watch} from "vue";
import {nativeApi} from "./api";

const props = defineProps<{uids: number[]}>();
const emit = defineEmits<{(e: "saved", uids: number[]): void}>();

const text = ref("");
const busy = ref(false);
const err = ref("");

watch(() => props.uids, (uids) => {
    text.value = uids.join(", ");
}, {immediate: true});

async function onSave() {
    err.value = "";
    busy.value = true;
    try {
        const uids = text.value
            .split(/[\s,]+/)
            .filter((t) => t.length > 0)
            .map(Number);
        if (uids.some((uid) => !Number.isInteger(uid) || uid <= 0)) {
            throw new Error("Chỉ nhận uid là số nguyên dương, cách nhau bởi dấu phẩy.");
        }
        const saved = await nativeApi.setExcludedUids(uids);
        emit("saved", saved.uids);
    } catch (e) {
        err.value = e instanceof Error ? e.message : String(e);
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <div class="card excluded">
        <h2>uid không tính vào thống kê</h2>
        <p class="muted note">
            Tài khoản test/admin. Lưu ở Redis nên đổi được ngay, không cần restart container. Chỉ ảnh
            hưởng phần thống kê: các ngày đã chốt sổ giữ nguyên danh sách cũ, và số "rút an toàn" luôn
            tính cả những uid này.
        </p>
        <div class="row">
            <input v-model="text" type="text" class="uids" placeholder="604, 33931" :disabled="busy"/>
            <button class="btn" :disabled="busy" @click="onSave">{{ busy ? "..." : "Lưu" }}</button>
        </div>
        <div v-if="err" class="error">{{ err }}</div>
    </div>
</template>

<style scoped>
.excluded {
    max-width: 640px;
}

.note {
    font-size: 13px;
    margin: 0 0 12px;
}

.row {
    display: flex;
    gap: 10px;
    align-items: center;
}

.uids {
    flex: 1;
}
</style>
