<script setup>
import { ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWebNotification } from "@vueuse/core";

const dialogOpen = ref(false);

const { permissionGranted, ensurePermissions, isSupported } = useWebNotification({
    requestPermissions: true,
});

// 當 permission 是 false 時跳出 Dialog
watch(
    permissionGranted,
    (granted) => {
        if (!granted && isSupported.value) {
            dialogOpen.value = true;
        }
    },
    { immediate: true }
);

// 點擊按鈕後請求授權
const requestPermission = async () => {
    const granted = await ensurePermissions();
    console.log("granted", granted);
    if (granted) {
        dialogOpen.value = false;
    } else {
        alert("請手動前往瀏覽器設定中允許通知");
    }
};
</script>

<template>
    <Dialog :open="dialogOpen" @update:open="dialogOpen = $event">
        <DialogContent class="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>🔔 允許桌面通知</DialogTitle>
                <DialogDescription> 為了讓您在任務完成時能即時收到通知，我們需要開啟通知權限。 </DialogDescription>
            </DialogHeader>

            <!-- 圖片顯示區 -->
            <div class="flex justify-center py-2">
                <img src="/grantPermission.png" alt="通知權限圖片" class="rounded-lg shadow-md" draggable="false" />
            </div>

            <!-- 按鈕區 -->
            <div class="flex gap-2 justify-end">
                <Button variant="outline" @click="dialogOpen = false">稍後再說</Button>
                <Button @click="requestPermission">允許通知</Button>
            </div>
        </DialogContent>
    </Dialog>
</template>

<style scoped>
img {
    -webkit-user-drag: none;
}
</style>
