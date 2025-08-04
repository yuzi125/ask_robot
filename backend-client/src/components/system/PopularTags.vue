<script setup>
import { ref, inject, watch } from "vue";
const axios = inject("axios");
const emitter = inject("emitter");

const props = defineProps({
    modelValue: {
        type: Array,
        default: () => []
    },
    scope: {
        type: String,
        default: ""
    }
});

const emit = defineEmits(["update:modelValue"]);

// 已完成的標籤列表
const tags = ref(props.modelValue?.currentIcons || []);

// 可選擇的icon列表
const icons = ref([]);

// 從後端獲取icon列表
const getIconList = async () => {
    try {
        const response = await axios.get("/system/getIconList");
        if (response.data.code === 0) {
            icons.value = response.data.data.map(icon => ({
                icon: icon.icon,
                name: icon.name
            }));
        }
    } catch (error) {
        emitter.emit("openSnackbar", { message: "獲取圖標列表失敗", color: "error" });
    }
};

// 組件掛載時獲取icon列表
getIconList();


// 當前選擇的icon
const selectedIcon = ref("");
// 批量選擇的icons
const selectedIcons = ref([]);
// 新標籤名稱
const newTagName = ref("");
// 新標籤內容
const newTagContent = ref("");

// 監聽 props.modelValue 的變化
watch(() => props.modelValue, (newValue) => {
    // 創建一個新的陣列來避免tanstack只讀問題
    tags.value = [...newValue];
}, { immediate: true });

// 新增熱門標籤
const addTag = async () => {
    if (!newTagName.value.trim()) {
        emitter.emit("openSnackbar", { message: "請輸入標籤名稱", color: "warning" });
        return;
    }

    // 檢查標籤名稱是否已存在
    const isTagNameExists = tags.value.some(tag => tag.name === newTagName.value.trim());
    if (isTagNameExists) {
        emitter.emit("openSnackbar", { message: "標籤名稱已存在", color: "warning" });
        return;
    }

    const newTag = {
        icon: selectedIcon.value || "",
        name: newTagName.value.trim(),
        content: newTagContent.value.trim()
    };

    tags.value.push(newTag);
    emit("update:modelValue", tags.value);

    selectedIcon.value = "";
    newTagName.value = "";
    newTagContent.value = "";
};

// 刪除標籤
const deleteTag = async (index) => {
    const newArray = [...tags.value];
    newArray.splice(index, 1);
    emit("update:modelValue", newArray);
};

const showDialog = ref(false);

const newIcon = ref({
    icon: "",
    name: ""
});

const addNewIcon = async () => {
    showDialog.value = true;
};

const submitNewIcon = async () => {
    try {
        // 檢查必填欄位
        if (!newIcon.value.icon || !newIcon.value.name) {
            emitter.emit("openSnackbar", { message: "請填寫完整資料", color: "warning" });
            return;
        }
    
        // 檢查圖示名稱是否重複
        const isIconExists = icons.value.some(icon => icon.name === newIcon.value.name);
        if (isIconExists) {
            emitter.emit("openSnackbar", { message: "已有重複圖示", color: "warning" });
            return;
        }

        const response = await axios.post("/system/addIcon", newIcon.value);
        
        if (response.data.code === 0) {
            emitter.emit("openSnackbar", { message: "新增圖示成功", color: "success" });
            // 重新取得icon列表
            await getIconList();
            showDialog.value = false;
            resetForm();
        } else {
            throw new Error(response.data.message || "新增失敗");
        }
    } catch (error) {
        emitter.emit("openSnackbar", { message: error.message || "新增圖示失敗", color: "error" });
    }
};

const resetForm = () => {
    newIcon.value = {
        icon: "",
        name: ""
    };
};

const showDeleteConfirmation = ref(false);

const toggleDeleteConfirmation = () => {    
    showDeleteConfirmation.value = !showDeleteConfirmation.value;
    selectedIcons.value = [];    
    selectedIcon.value = "";
};

// 切換選中狀態
const toggleIconSelection = (iconName) => {
    if (selectedIcons.value.includes(iconName)) {
        selectedIcons.value = selectedIcons.value.filter(name => name !== iconName);
    } else {
        selectedIcons.value.push(iconName);
    }
};

// 確認刪除選中的icons
const confirmDeleteIcon = async () => {
    if (selectedIcons.value.length > 0) {
        try {
            const response = await axios.post("/system/deleteIcon", { names: selectedIcons.value });
            if (response.data.code === 0) {
                emitter.emit("openSnackbar", { message: "刪除圖示成功", color: "success" });
                await getIconList();
            }
        } catch (error) {
            emitter.emit("openSnackbar", { message: error.message || "刪除圖示失敗", color: "error" });
        }
    }
    showDeleteConfirmation.value = false;
    selectedIcons.value = [];
};

const cancelDeleteIcon = () => {
    showDeleteConfirmation.value = false;
    selectedIcons.value = [];
};

const showEnter = (el, done) => {
    el.style.transform = 'translateX(10%)';
    el.style.opacity = '0';
    setTimeout(() => {
        el.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        el.style.transform = 'translateX(0)';
        el.style.opacity = '1';
        done();
    }, 0);
};

const showLeave = (el, done) => {
    el.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    el.style.transform = 'translateX(10px)';
    el.style.opacity = '0';
    setTimeout(done, 300);
};
</script>

<template>
    <div class="popularTagsContainer list position-relative">
        <div class="popularTagsLabel">
            <label class="mb-1 rounded text-h6 d-flex">
                <p>熱門標籤設定</p>
                <span class="mdi mdi-help-circle text-grey"></span>
                <v-tooltip activator="parent" location="top"
                    >設定熱門標籤以便快速訪問。</v-tooltip
                >
            </label>
        </div>

        <div style="background-color: hsl(0, 0%, 92%); padding: 10px; margin-bottom: 12px;">
            <!-- 區塊一：已完成的標籤列表 -->
            <div v-if="tags?.length > 0" class="mb-4 chipContainer">
                <v-chip
                    v-for="(tag, index) in tags"
                    :key="tag.name"
                    class="ma-1 custom-chip"
                    closable
                    @click:close="deleteTag(index)"
                    style="padding-left: 20px; cursor: pointer;"
                >
                    <v-icon v-if="tag.icon" start :icon="tag.icon"></v-icon>
                    {{ tag.name }}
                    <v-tooltip v-if="tag.content" activator="parent" location="top" max-width="900">
                        {{ tag.content }}
                    </v-tooltip>
                </v-chip>
            </div>

            <!-- 區塊二：Icon選擇區 -->
            <div class="mb-4 chipContainer">
                <div class="d-flex" style="cursor: default;">
                    <h3 class="text-subtitle-1 mb-2 d-flex align-items-center">選擇圖示</h3>
                    <v-btn
                        color="red"
                        variant="text"
                        @click="toggleDeleteConfirmation"
                        style="padding: 0; min-width: 10px; height: 26px; margin-left: 1rem;"
                    >
                        <v-icon icon="fa-solid fa-trash" size="14"></v-icon>
                        <v-tooltip activator="parent" location="top" content-class="custom-tooltip" v-if="!showDeleteConfirmation">
                            刪除icon
                        </v-tooltip>
                    </v-btn>
                    <transition name="slide-fade" @enter="showEnter" @leave="showLeave">
                        <div v-if="showDeleteConfirmation" class="delete-confirmation">
                            <v-btn
                                color="grey"
                                variant="text"
                                @click="cancelDeleteIcon"
                                style="padding: 0; min-width: 10px; height: 26px; margin-left: 0.9rem;"
                            >
                                <v-icon icon="fa-solid fa-xmark" size="14"></v-icon>
                                取消
                            </v-btn>                        
                            <v-btn
                                color="green"
                                variant="text"
                                @click="confirmDeleteIcon"
                                style="padding: 0; min-width: 10px; height: 26px; margin-left: 0.6rem;"
                            >
                                <v-icon icon="fa-solid fa-check" size="14"></v-icon>
                                確認刪除
                            </v-btn>
                        </div>
                    </transition>
                </div>

                <div class="icon-button-group" style="cursor: default;">
                    <v-btn
                        v-for="icon in icons"
                        :key="icon.icon"
                        class="ma-1 pa-1 icon-button"
                        variant="outlined"
                        :color="showDeleteConfirmation && selectedIcons.includes(icon.icon) ? 'red' : (selectedIcon === icon.icon ? 'primary' : '')"
                        @click="showDeleteConfirmation ? toggleIconSelection(icon.icon) : selectedIcon = (selectedIcon === icon.icon ? '' : icon.icon)"
                        style="min-width: 40px; height: 40px;"
                    >
                        <v-icon :icon="icon.icon" size="18"></v-icon>
                        <v-tooltip activator="parent" location="top">
                            {{ icon.name }}
                        </v-tooltip>
                    </v-btn>
                    <v-btn
                        class="ma-1 pa-1 icon-button"
                        variant="text"
                        @click="addNewIcon"
                        style="min-width: 40px; height: 40px; border: none;"
                    >
                        <v-icon icon="fa-solid fa-circle-plus" size="16"></v-icon>
                        <v-tooltip activator="parent" location="top">
                            新增圖示
                        </v-tooltip>
                    </v-btn>
                </div>
            </div>

            <!-- 區塊三：標籤名稱輸入 -->
            <div class="d-flex align-center">
                <v-text-field
                    v-model="newTagName"
                    label="標籤名稱 *"
                    class="mr-4"
                    :hint="scope !== 'global' ? '輸入想新增的熱門標籤 (若與「系統設定」重複，則以系統設定為準)' : '輸入想新增的熱門標籤'"
                    persistent-hint
                ></v-text-field>
            </div>

            <!-- 區塊四：標籤內容輸入 -->
            <div class="d-flex align-center">
                <v-text-field
                    v-model="newTagContent"
                    label="標籤內容"
                    class="mr-4"
                    hint="輸入想附加的內容 (不填會以「標籤名稱」為內容)"
                    persistent-hint
                ></v-text-field>
            </div>
            <div class="d-flex justify-end" style="padding-right: 1rem;">
                <v-btn color="primary" @click="addTag" :disabled="!newTagName" style="margin-top: -1.2rem; margin-bottom: 0.2rem;">
                    新增標籤
                </v-btn>
            </div>
        </div>

    </div>

    <v-dialog v-model="showDialog" max-width="600px" v-bind="$attrs">
        <v-card>
            <v-card-title class="text-h5" style="padding-top: 1.1rem; padding-left: 1.4rem; padding-bottom: 0;">新增圖示</v-card-title>
            <v-card-text style="padding-top: 0; padding-bottom: 0;">
                <v-container style="padding-bottom: 0;">
                    <v-row>
                        <v-col cols="12">
                            <v-text-field
                                v-model="newIcon.icon"
                                label="圖示名稱"
                                hint="例如：fa-solid fa-star"
                                persistent-hint
                                required
                            ></v-text-field>
                        </v-col>
                        <v-col cols="12">
                            <v-text-field
                                v-model="newIcon.name"
                                label="圖示說明"
                                hint="例如：星星"
                                persistent-hint
                                required
                            ></v-text-field>
                        </v-col>
                    </v-row>
                </v-container>
            </v-card-text>
            <v-card-actions style="padding-top: 0;">
                <v-spacer></v-spacer>
                <v-btn color="error" variant="text" @click="showDialog = false">取消</v-btn>
                <v-btn color="primary" variant="text" @click="submitNewIcon">確認</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.popularTagsContainer {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 300px;
}

.popularTagsLabel {
    width: 100%;
    display: flex;
    align-items: flex-start;
}

.chipContainer {
    flex-wrap: wrap;
    padding: 10px;
    background-color: #f5f5f5;
    border-radius: 8px;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.custom-chip {
    align-items: center;
    font-weight: 500;
    letter-spacing: 0.5px;
    transition: all 0.3s ease;
    background-color: #4d63dd !important;
    /* background-color: var(--theme-color) !important;  */
    color: #ffffff;
    padding-top: 2px;
}

.custom-chip:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

:deep(.custom-chip .v-chip__close) {
    opacity: 0.7;
    transition: opacity 0.3s ease;
}

:deep(.custom-chip:hover .v-chip__close) {
    opacity: 1;
}

.d-flex.align-center {
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: 20px;
}

.icon-button-group {
    display: flex;
    flex-wrap: wrap;
}

.icon-button {
    border: 1px solid #ccc; /* 自定義邊框顏色 */
    margin: 0; /* 移除按鈕之間的間距 */
    border-radius: 4px; /* 可選：設置圓角 */
}

.custom-chip .v-icon {
    font-size: 15px !important;
    margin-top: -2px;
}

.delete-confirmation {
    display: flex;
}

:deep(.custom-tooltip) {
    padding-left: 0.7rem !important;
    padding-right: 0.7rem !important;
}
</style> 