<script setup>
import { ref, inject, computed, watch, watchEffect } from "vue";
import { UseWindowSize } from "@vueuse/components";
import { useTheme } from "@/composables/useTheme";
import { useMutation } from "@tanstack/vue-query";
import ThemeOperations from "@/components/system/theme/ThemeOperations.vue";
import ThemeInstructions from "@/components/system/theme/ThemeInstructions.vue";
import ThemeHeader from "@/components/system/theme/ThemeHeader.vue";
import PreviewChat from "@/components/system/theme/PreviewChat.vue";
import ColorAdjustmentPanel from "@/components/system/theme/ColorAdjustmentPanel.vue";
import user from "@/assets/user_man.png";
import robot from "@/assets/robot.png";
import ManageThemeDialog from "@/components/system/theme/ManageThemeDialog.vue";
import GenerateThemeDialog from "@/components/system/theme/GenerateThemeDialog.vue";
import useSaveShortcut from "@/composables/useSaveShortcut";
const emitter = inject("emitter");
const axios = inject("axios");
// 獲取主題相關數據和方法
const { themes, isLoading, error, refetch, createThemeMutation, lockTheme, refetchLockTheme, createThemeError } =
    useTheme(axios);
const username = ref("使用者");
const menuItems = ref([
    { icon: "mdi-account-group", text: "高市府智能客服" },
    { icon: "mdi-briefcase", text: "運動發展局-專家" },
    { icon: "mdi-brain", text: "高雄市立空中大學-專家" },
    { icon: "mdi-headset", text: "都市發展局-專家" },
    { icon: "mdi-database", text: "人事處-專家" },
    { icon: "mdi-office-building", text: "農業局-專家" },
    { icon: "mdi-wrench", text: "主計處-專家" },
    { icon: "mdi-factory", text: "消防局-專家" },
    { icon: "mdi-city", text: "環境保護局-專家" },
]);

const messages = ref([
    {
        avatar: user,
        text: "歡迎使用",
    },
    {
        avatar: robot,
        text: "大家好，我是高雄市智能客服，有什麼問題可以問我喔。",
    },
]);

// 顏色控制
const colors = ref({
    base: {},
    topBar: {},
    chatArea: {},
    inputArea: {},
    navigation: {},
});

// 控制顏色選擇器的顯示
const colorPickers = ref({
    base: {
        primary: false,
        secondary: false,
        tertiary: false,
    },
    navigation: { bg: false, text: false, roomActiveBg: false },
    topBar: { bg: false, text: false },
    chatArea: {
        bg: false,
        text: false,
        robotBg: false,
        userBg: false,
    },
    inputArea: { bg: false, text: false },
});
// 新主題對話框控
const showThemeDialog = ref(false);
const newThemeName = ref("");
const newThemeRemark = ref("");

// 匯入主題
// 匯入主題對話框控
const showImportThemeDialog = ref(false);

// 匯入主題資料
const importThemeData = ref({
    themeName: "",
    themeRemark: "",
    themeColors: "",
});

// 打開匯入資料的對話框
const openImportThemeDialog = () => {
    showImportThemeDialog.value = true;
};

// 驗證輸入的資料是否為JSON
function isJson(item) {
    let value = typeof item !== "string" ? JSON.stringify(item) : item;
    try {
        value = JSON.parse(value);
    } catch (e) {
        return false;
    }

    return typeof value === "object" && value !== null;
}
// 判斷是否顯示錯誤
const hasInputJSONError = computed(() => {
    //空值不顯示錯誤
    if (importThemeData.value.themeColors !== "") return !isJson(importThemeData.value.themeColors);
    return false;
});

// 驗證資料正確
const isSaveButtonDisabled = computed(() => {
    // 如果資料為空、資料格式不正確、主題名稱不符合規則，則返回true
    if (
        importThemeData.value.themeColors === "" ||
        importThemeData.value.themeName === "" ||
        importThemeData.value.themeRemark === "" ||
        !isJson(importThemeData.value.themeColors) ||
        !/^[a-zA-Z0-9_-]+$/.test(importThemeData.value.themeName)
    )
        return true;

    return false;
});

const importTheme = async () => {
    try {
        // 儲存新主題
        await createThemeMutation.mutateAsync({
            name: importThemeData.value.themeName,
            remark: importThemeData.value.themeRemark,
            colors: JSON.parse(importThemeData.value.themeColors),
        });

        // 等待主題列表更新完成
        await refetch();

        // 呼叫 API 更新當前主題
        // await updateCurrentThemeMutation.mutateAsync({
        //     name: newTheme.name,
        //     colors: colors.value,
        // });

        // 顯示成功訊息
        emitter.emit("openSnackbar", {
            message: "成功匯入主題",
            color: "success",
        });

        // 關閉匯入對話框
        showImportThemeDialog.value = false;

        // 關閉對話框並清空輸入
        importThemeData.value.themeName = "";
        importThemeData.value.themeColors = "";
        importThemeData.value.themeRemark = "";
    } catch (error) {
        console.error("匯入主題失敗:", error);
        emitter.emit("openSnackbar", {
            message: "匯入主題失敗，請稍後再試",
            color: "error",
        });
    }
};

const exportTheme = async () => {
    const exportColor = JSON.parse(JSON.stringify(colors.value));
    //移除remark
    delete exportColor.remark;
    //移除is_system
    delete exportColor.is_system;
    await navigator.clipboard.writeText(JSON.stringify(exportColor));
    emitter.emit("openSnackbar", { message: `已複製 ${colors.value.remark} 主題的配色`, color: "success" });
};
// 控制彈窗顏色選擇器
const showDialog = ref(false);
const activeColorPicker = ref({
    section: null,
    type: "bg",
});

// 當前選中的主題
const currentTheme = ref("ocean");

// 先定義一個 sections 配置對象
const sections = {
    navigation: {
        icon: "mdi-menu",
        title: "導航欄",
    },
    topBar: {
        icon: "mdi-view-headline",
        title: "頂部欄",
    },
    chatArea: {
        icon: "mdi-message-text", // 新增聊天區域的圖標
        title: "對話區域",
    },
    inputArea: {
        icon: "mdi-keyboard",
        title: "輸入區域",
    },
};

// 調色盤顏色
const swatches = [
    ["#FF0000", "#AA0000", "#550000"],
    ["#FFFF00", "#AAAA00", "#555500"],
    ["#00FF00", "#00AA00", "#005500"],
    ["#00FFFF", "#00AAAA", "#005555"],
    ["#0000FF", "#0000AA", "#000055"],
];

const activeTab = ref("base"); // 控制當前active的tab
const activePanel = ref(null); // 當前打開的面板

const dialogType = ref("main"); // 'main' | 'robot' | 'user'

const updateThemeColorsLoading = ref(false);
const updateCurrentThemeLoading = ref(false);
const toggleLockThemeLoading = ref(false);

// 計算當前要修改的顏色值
const getCurrentColorValue = computed({
    get: () => {
        if (activeColorPicker.value.section === "chatArea") {
            switch (dialogType.value) {
                case "main":
                    return colors.value.chatArea[activeColorPicker.value.type];
                case "robot":
                    return colors.value.chatArea[`robot${activeColorPicker.value.type === "bg" ? "Bg" : "Text"}`];
                case "user":
                    return colors.value.chatArea[`user${activeColorPicker.value.type === "bg" ? "Bg" : "Text"}`];
                default:
                    return colors.value.chatArea[activeColorPicker.value.type];
            }
        }
        return colors.value[activeColorPicker.value.section][activeColorPicker.value.type];
    },
    set: (value) => {
        handleDialogColorUpdate(value);
    },
});

// 修改更新顏色的處理函數
const handleAreaColorUpdate = (section, type, color) => {
    colors.value[section][type] = color;
};

const handleDialogColorUpdate = (color) => {
    if (activeColorPicker.value.section === "chatArea") {
        let type = activeColorPicker.value.type;
        switch (dialogType.value) {
            case "main":
                colors.value[activeColorPicker.value.section][type] = color;
                break;
            case "robot":
                colors.value.chatArea[`robot${type === "bg" ? "Bg" : "Text"}`] = color;
                break;
            case "user":
                colors.value.chatArea[`user${type === "bg" ? "Bg" : "Text"}`] = color;
                break;
        }
    } else {
        colors.value[activeColorPicker.value.section][activeColorPicker.value.type] = color;
    }
};

// 更新主題的 mutation
const updateThemeColorsMutation = useMutation({
    mutationFn: async (data) => {
        console.log(data);
        const response = await axios.put("/system/updateChatThemeColors", data);
        if (response.data.code === 0) {
            return response.data.data;
        }
        throw new Error(response.data.message);
    },

    onSuccess: () => {
        // 重新獲取主題列表
        refetch();
        emitter.emit("openSnackbar", { message: `已更新 ${currentTheme.value} 主題的配色`, color: "success" });
    },
});

const updateCurrentThemeMutation = useMutation({
    mutationFn: async (data) => {
        const response = await axios.put("/system/updateCurrentChatTheme", data);
        if (response.data.code === 0) {
            return response.data.data;
        }
        throw new Error(response.data.message);
    },
    onSuccess: () => {
        refetch();
        emitter.emit("openSnackbar", { message: `已套用 ${currentTheme.value} 主題`, color: "success" });
    },
});

const toggleLockThemeMutation = useMutation({
    mutationFn: async () => {
        const response = await axios.put("/system/toggleLockTheme", { toggleStatus: !lockTheme.value });
    },
    onSuccess: () => {
        refetchLockTheme();
        emitter.emit("openSnackbar", {
            message: `已${lockTheme.value ? "解除" : "鎖定"}主題`,
            color: "success",
        });
    },
});
// 更新當前主題顏色設定
const updateCurrentThemeColors = async () => {
    if (!currentTheme.value) return;

    try {
        updateThemeColorsLoading.value = true;
        await updateThemeColorsMutation.mutateAsync({
            name: currentTheme.value,
            colors: colors.value,
        });
        // 更新成功後，更新本地快取的主題數據
        if (themes.value) {
            themes.value[currentTheme.value] = JSON.parse(JSON.stringify(colors.value));
        }
    } catch (error) {
        console.error("更新主題顏色失敗:", error);
        emitter.emit("openSnackbar", {
            message: "更新主題顏色失敗，請稍後再試",
            color: "error",
        });
    } finally {
        updateThemeColorsLoading.value = false;
    }
};

const updateCurrentTheme = async () => {
    if (!currentTheme.value) return;

    try {
        updateCurrentThemeLoading.value = true;
        await updateCurrentThemeMutation.mutateAsync({
            name: currentTheme.value,
            colors: colors.value,
        });

        updateCurrentThemeLoading.value = false;
    } catch (error) {
        console.error("切換主題失敗:", error);
        updateCurrentThemeLoading.value = false;
    } finally {
        updateCurrentThemeLoading.value = false;
    }
};

const updateLockTheme = async () => {
    try {
        toggleLockThemeLoading.value = true;
        await toggleLockThemeMutation.mutateAsync();
    } catch (error) {
        console.error("切換主題鎖定狀態失敗:", error);
    } finally {
        toggleLockThemeLoading.value = false;
    }
};

// 更新顏色
const handleColorUpdate = (section, type, color) => {
    colors.value[section][type] = color;
};

// 處理區塊點擊事件
const handleSectionClick = (section, event) => {
    event.stopPropagation();
    showDialog.value = true;
    activeColorPicker.value.section = section;
};

// 切換顏色類型（背景/文字）
const toggleColorType = (type) => {
    activeColorPicker.value.type = type;
};

// 關閉顏色選擇器
const closeColorPicker = () => {
    showDialog.value = false;
    activeColorPicker.value.section = null;
};

// 點擊空白處關閉顏色選擇器
const handleGlobalClick = (event) => {
    if (!event.target.closest(".color-picker-container")) {
        closeColorPicker();
    }
};

// 處理主題選擇
const handleThemeSelect = async (themeName) => {
    if (themes.value?.[themeName]) {
        // 更新顏色設定
        colors.value = JSON.parse(JSON.stringify(themes.value[themeName]));
        currentTheme.value = themeName;
        // 直接呼叫 API 更新當前主題
        try {
            updateCurrentThemeLoading.value = true;
            await updateCurrentThemeMutation.mutateAsync({
                name: themeName,
                colors: themes.value[themeName],
            });
        } catch (error) {
            console.error("切換主題失敗:", error);
            emitter.emit("openSnackbar", {
                message: "切換主題失敗，請稍後再試",
                color: "error",
            });
        } finally {
            updateCurrentThemeLoading.value = false;
        }
    }
};

// 儲存新主題
const saveTheme = () => {
    showThemeDialog.value = true;
};

// 確認儲存主題
const confirmSaveTheme = async () => {
    if (newThemeName.value && /^[a-zA-Z0-9_-]+$/.test(newThemeName.value)) {
        try {
            // 儲存新主題
            const newTheme = await createThemeMutation.mutateAsync({
                name: newThemeName.value,
                remark: newThemeRemark.value,
                colors: colors.value,
            });

            // 關閉對話框並清空輸入
            showThemeDialog.value = false;
            newThemeName.value = "";
            newThemeRemark.value = "";

            // 等待主題列表更新完成
            await refetch();

            // 設定當前主題為新建立的主題
            currentTheme.value = newTheme.name;
            colors.value = JSON.parse(JSON.stringify(colors.value));

            // 呼叫 API 更新當前主題
            await updateCurrentThemeMutation.mutateAsync({
                name: newTheme.name,
                colors: colors.value,
            });

            // 顯示成功訊息
            emitter.emit("openSnackbar", {
                message: "已建立新主題並套用",
                color: "success",
            });
        } catch (error) {
            console.error("儲存主題失敗:", error);
            emitter.emit("openSnackbar", {
                message: "建立主題失敗，請稍後再試",
                color: "error",
            });
        }
    }
};
// 應用主題
const applyTheme = (themeName) => {
    if (themes.value?.[themeName]) {
        colors.value = JSON.parse(JSON.stringify(themes.value[themeName]));
    }
};

const handleColorPickerVisibility = (section, type, value) => {
    colorPickers.value[section][type] = value;
};

// 切換主題鎖定狀態
const toggleLockTheme = async () => {
    await refetchLockTheme();
};

// 在開啟對話框時重置類型
watch(showDialog, (newValue) => {
    if (newValue) {
        dialogType.value = "main";
    }
});

// 監聽 themes 數據變化，設定初始主題
watchEffect(() => {
    if (themes.value && Object.keys(themes.value).length > 0) {
        // 獲取第一個主題的名稱
        const firstThemeName = Object.keys(themes.value)[0];
        // 設定當前主題
        currentTheme.value = firstThemeName;
        // 套用主題顏色
        colors.value = JSON.parse(JSON.stringify(themes.value[firstThemeName]));
    }
});

// 移除原本的狀態和方法，只保留 dialog 控制
const showEditThemesDialog = ref(false);

// 移除其他相關的方法，只保留開啟 dialog 的方法
const handleEditThemes = () => {
    showEditThemesDialog.value = true;
};

const generatingTheme = ref(false);
const showGenerateThemeDialog = ref(false);

// 添加一個變數存儲生成的主題
const generatedThemeData = ref(null);

// 修改 generateThemeMutation 的 onSuccess
const generateThemeMutation = useMutation({
    mutationFn: async (prompt) => {
        const response = await axios.post("/system/generateTheme", { prompt });
        if (response.data.code === 0) {
            return response.data.data;
        }
        throw new Error(response.data.message);
    },
    onSuccess: (data) => {
        // 存儲生成的主題數據
        generatedThemeData.value = data;

        // 切換到新生成的主題進行預覽
        currentTheme.value = data.name;
        colors.value = JSON.parse(JSON.stringify(data.colors));

        emitter.emit("openSnackbar", {
            message: "主題生成成功，請預覽效果",
            color: "success",
        });
    },
});

// 處理儲存生成的主題
// 修改處理儲存生成的主題的方法
const handleSaveGeneratedTheme = async (editedTheme) => {
    try {
        if (editedTheme) {
            await createThemeMutation.mutateAsync({
                name: editedTheme.name,
                remark: editedTheme.remark,
                colors: JSON.parse(JSON.stringify(editedTheme.colors)),
            });

            // 清空生成的主題數據
            generatedThemeData.value = null;
            // 關閉對話框
            showGenerateThemeDialog.value = false;

            emitter.emit("openSnackbar", {
                message: "主題儲存成功",
                color: "success",
            });
        }
    } catch (error) {
        emitter.emit("openSnackbar", { message: error.message, color: "error" });
    }
};

// 打開生成主題對話框
const handleOpenGenerateThemeDialog = () => {
    showGenerateThemeDialog.value = true;
};

// 處理生成主題
const handleGenerateTheme = async (prompt) => {
    try {
        generatingTheme.value = true;
        await generateThemeMutation.mutateAsync(prompt);
    } catch (error) {
        console.error("生成主題失敗:", error);
        emitter.emit("openSnackbar", {
            message: "生成主題失敗，請稍後再試",
            color: "error",
        });
    } finally {
        generatingTheme.value = false;
    }
};

// 設定 ctrl+s 快捷鍵
useSaveShortcut(updateCurrentThemeColors);
</script>

<template>
    <div class="bulletin_view">
        <div v-if="isLoading" class="">
            <v-skeleton-loader class="mx-auto" elevation="2" type="paragraph, paragraph"></v-skeleton-loader>
        </div>
        <!-- 載入狀態 -->

        <!-- 錯誤狀態 -->
        <v-alert v-else-if="error" type="error" class="ma-4">
            {{ error.message }}
        </v-alert>

        <template v-else>
            <!-- 主題選擇區域 -->
            <UseWindowSize v-slot="{ width }">
                <div class="mb-6 theme-controls">
                    <v-card>
                        <!-- 主標題區域 -->
                        <ThemeHeader
                            :is-locked="lockTheme"
                            :toggle-lock-theme-loading="toggleLockThemeLoading"
                            @toggle-lock="updateLockTheme"
                        />

                        <v-divider></v-divider>

                        <!-- 主題操作區域 -->
                        <div class="pa-6">
                            <ThemeOperations
                                v-model:currentTheme="currentTheme"
                                :themes="themes"
                                :update-current-theme-loading="updateCurrentThemeLoading"
                                :update-theme-colors-loading="updateThemeColorsLoading"
                                :generating-theme="generatingTheme"
                                @edit-themes="handleEditThemes"
                                @save-theme="saveTheme"
                                @generate-theme="handleOpenGenerateThemeDialog"
                                @update-theme-colors="updateCurrentThemeColors"
                                @update:currentTheme="handleThemeSelect"
                                @import-theme="openImportThemeDialog"
                                @export-theme="exportTheme"
                            />

                            <ThemeInstructions />
                        </div>
                    </v-card>
                </div>

                <div class="mb-6 color-controls">
                    <v-card class="d-flex" :class="{ 'flex-column': width <= 1600 }">
                        <!-- 左側顏色調整區域 -->
                        <ColorAdjustmentPanel
                            :width="width"
                            v-model="activeTab"
                            v-model:active-panel-value="activePanel"
                            :colors="colors"
                            :color-pickers="colorPickers"
                            :swatches="swatches"
                            :sections="sections"
                            @update-color="handleAreaColorUpdate"
                            @update:color-pickers="handleColorPickerVisibility"
                        />

                        <!-- 右側預覽區域 -->
                        <div class="flex-grow-1">
                            <div class="pa-4">
                                <v-layout class="rounded chat-container">
                                    <div class="d-flex full-height">
                                        <PreviewChat
                                            :colors="colors"
                                            :active-panel="activePanel"
                                            :menu-items="menuItems"
                                            :messages="messages"
                                            :username="username"
                                            @section-click="handleSectionClick"
                                        />
                                    </div>
                                </v-layout>
                            </div>
                        </div>
                    </v-card>
                </div>

                <v-dialog v-model="showDialog" :retain-focus="false" width="600">
                    <v-card class="color-picker-container">
                        <v-card-title>選擇顏色</v-card-title>
                        <v-card-text>
                            <template v-if="activeColorPicker.section === 'chatArea'">
                                <!-- 對話框類型選擇 -->
                                <div class="mb-4">
                                    <span class="mb-2 text-subtitle-2 d-block">對話框類型</span>
                                    <div class="ga-2 d-flex">
                                        <v-btn
                                            :color="dialogType === 'main' ? 'primary' : ''"
                                            @click="dialogType = 'main'"
                                            variant="tonal"
                                        >
                                            主要區域
                                        </v-btn>
                                        <v-btn
                                            :color="dialogType === 'robot' ? 'primary' : ''"
                                            @click="dialogType = 'robot'"
                                            variant="tonal"
                                        >
                                            機器人對話框
                                        </v-btn>
                                        <v-btn
                                            :color="dialogType === 'user' ? 'primary' : ''"
                                            @click="dialogType = 'user'"
                                            variant="tonal"
                                        >
                                            使用者對話框
                                        </v-btn>
                                    </div>
                                </div>

                                <!-- 顏色類型選擇 -->
                                <div class="mb-4">
                                    <span class="mb-2 text-subtitle-2 d-block">顏色類型</span>
                                    <div class="ga-2 d-flex">
                                        <v-btn
                                            :color="activeColorPicker.type === 'bg' ? 'primary' : ''"
                                            @click="toggleColorType('bg')"
                                            variant="tonal"
                                        >
                                            背景顏色
                                        </v-btn>
                                        <v-btn
                                            v-if="dialogType !== 'main'"
                                            :color="activeColorPicker.type === 'text' ? 'primary' : ''"
                                            @click="toggleColorType('text')"
                                            variant="tonal"
                                        >
                                            文字顏色
                                        </v-btn>
                                    </div>
                                </div>
                            </template>
                            <template v-else>
                                <div class="mb-4 ga-2 d-flex">
                                    <v-btn
                                        :color="activeColorPicker.type === 'bg' ? 'primary' : ''"
                                        @click="toggleColorType('bg')"
                                        variant="tonal"
                                    >
                                        背景顏色
                                    </v-btn>
                                    <v-btn
                                        :color="activeColorPicker.type === 'text' ? 'primary' : ''"
                                        @click="toggleColorType('text')"
                                        variant="tonal"
                                    >
                                        文字顏色
                                    </v-btn>
                                    <v-btn
                                        v-if="activeColorPicker.section === 'navigation'"
                                        :color="activeColorPicker.type === 'roomActiveBg' ? 'primary' : ''"
                                        @click="toggleColorType('roomActiveBg')"
                                        variant="tonal"
                                    >
                                        當前聊天室顏色
                                    </v-btn>
                                </div>
                            </template>

                            <!-- 顏色選擇器 -->
                            <div class="justify-center d-flex">
                                <v-color-picker
                                    v-if="activeColorPicker.section"
                                    v-model="getCurrentColorValue"
                                    :swatches="swatches"
                                    show-swatches
                                    @update:model-value="handleDialogColorUpdate"
                                ></v-color-picker>
                            </div>
                        </v-card-text>
                    </v-card>
                </v-dialog>

                <!-- 儲存主題對話框 -->
                <v-dialog v-model="showThemeDialog" width="600">
                    <v-card>
                        <v-card-title>儲存主題</v-card-title>
                        <v-card-text>
                            <v-text-field
                                v-model="newThemeName"
                                label="主題色系名稱 (可包含英文字母、數字、-、_)"
                                :rules="[(v) => /^[a-zA-Z0-9_-]+$/.test(v) || '請輸入英文字母、數字、- 或 _ 符號']"
                                :error-messages="createThemeMutation.error?.message"
                            ></v-text-field>
                        </v-card-text>
                        <v-card-text>
                            <v-text-field
                                v-model="newThemeRemark"
                                label="主題顯示名稱"
                                :hint="`輸入描述後會顯示為：${newThemeName}(${
                                    newThemeRemark || '您輸入的描述'
                                })，前台聊天室則顯示為：${newThemeRemark}`"
                                persistent-hint
                                :error-messages="createThemeMutation.error?.message"
                            ></v-text-field>
                        </v-card-text>
                        <v-card-actions>
                            <v-spacer></v-spacer>
                            <v-btn color="grey darken-1" @click="showThemeDialog = false"> 關閉 </v-btn>
                            <v-btn
                                color="primary"
                                @click="confirmSaveTheme"
                                :disabled="!newThemeName || !/^[a-zA-Z0-9_-]+$/.test(newThemeName)"
                            >
                                儲存
                            </v-btn>
                        </v-card-actions>
                    </v-card>
                </v-dialog>

                <!-- 匯入主題對話框 -->
                <v-dialog v-model="showImportThemeDialog" width="600">
                    <v-card>
                        <v-card-title>匯入主題</v-card-title>
                        <v-card-text>
                            <v-text-field
                                v-model="importThemeData.themeName"
                                label="主題色系名稱 (可包含英文字母、數字、-、_)"
                                :rules="[(v) => /^[a-zA-Z0-9_-]+$/.test(v) || '請輸入英文字母、數字、- 或 _ 符號']"
                                :error-messages="createThemeMutation.error?.message"
                            ></v-text-field>
                        </v-card-text>
                        <v-card-text>
                            <v-text-field
                                v-model="importThemeData.themeRemark"
                                label="主題顯示名稱"
                                :hint="`輸入描述後會顯示為：${importThemeData.themeName}(${
                                    importThemeData.themeRemark || '您輸入的描述'
                                })，前台聊天室則顯示為：${importThemeData.themeName || '您輸入的描述'}`"
                                persistent-hint
                                :error-messages="createThemeMutation.error?.message"
                            ></v-text-field>
                        </v-card-text>
                        <v-card-text>
                            <v-textarea
                                v-model="importThemeData.themeColors"
                                label="匯入JSON"
                                :error-messages="hasInputJSONError ? '請輸入正確的JSON格式' : ''"
                            ></v-textarea>
                        </v-card-text>
                        <v-card-actions>
                            <v-spacer></v-spacer>
                            <v-btn color="grey darken-1" @click="showImportThemeDialog = false"> 關閉 </v-btn>
                            <v-btn color="primary" @click="importTheme" :disabled="isSaveButtonDisabled"> 儲存 </v-btn>
                        </v-card-actions>
                    </v-card>
                </v-dialog>

                <!-- 使用新的組件 -->
                <ManageThemeDialog v-model="showEditThemesDialog" :themes="themes" :onRefetch="refetch" />

                <GenerateThemeDialog
                    v-model="showGenerateThemeDialog"
                    :generating="generatingTheme"
                    :generated-theme="generatedThemeData"
                    @generate="handleGenerateTheme"
                    @save-generated-theme="handleSaveGeneratedTheme"
                />
            </UseWindowSize>
        </template>
    </div>
</template>

<style lang="scss" scoped>
.bulletin_view {
    padding: 2rem;
    width: 100%;
    height: 100%;

    .chat-container {
        width: 100%;
        height: calc(100vh - 14rem);
        overflow: hidden;
        padding-bottom: 20px;
    }

    .full-height {
        height: 100%;
        width: 100%;
    }
}

.theme-controls {
    .theme-actions {
        @media (max-width: 960px) {
            flex-direction: column;
            align-items: stretch;

            .button-group {
                margin-top: 1rem;
                justify-content: flex-end;
            }
        }
    }

    .current-theme-label {
        white-space: nowrap;
    }

    .theme-preview {
        background-color: rgba(var(--v-theme-surface-variant), 0.1);
    }

    .button-group {
        @media (max-width: 600px) {
            flex-direction: column;
            width: 100%;

            .v-btn {
                margin-right: 0;
                margin-bottom: 0.5rem;
                width: 100%;
            }
        }
    }

    .theme-select {
        :deep(.v-field__input) {
            padding-top: 5px;
            padding-bottom: 5px;
        }
    }
}

// 確保預覽容器內的元素可以正確顯示高亮效果
.preview-layout {
    position: relative;
    z-index: 0;
}

.max-width-200 {
    max-width: 200px;
}

@media (max-width: 600px) {
    .theme-selector {
        margin-bottom: 16px;
    }
}
</style>
