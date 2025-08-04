<script setup>
import { ref, inject, computed } from "vue";
const emitter = inject("emitter");

import { getExpertsAndSetting, updateLineExpert, updateLineSetting } from "@/network/service";
import ColorPicker from "@/components/system/theme/ColorPicker.vue";

// 取值
const basicData = ref({});
const loadingData = ref(false);
const firstLoad = ref(true);
async function getData() {
    loadingData.value = true;
    try {
        const response = await getExpertsAndSetting();
        basicData.value = response.data.data;
        experts.value = response.data.data.experts;
        selectedLineExpert.value = response.data.data.selectedExpert;

        const lineSettings = JSON.parse(response.data.data.lineSettings);
        displayOtherAlsoAsk.value = lineSettings.other_also_ask;
        colors.value.textColor = lineSettings.text_color;
        colors.value.aTagColor = lineSettings.a_tag_color;
        colors.value.boldColor = lineSettings.bold_color;
        colors.value.backgroundColor = lineSettings.background_color;
        listStyles.value = lineSettings.ul_marks;
    } catch (error) {
        emitter.emit("openSnackbar", { message: "取得資料發生錯誤。", color: "error" });
        experts.value = [];
    } finally {
        loadingData.value = false;
        firstLoad.value = false;
    }
}
getData();


// LINE BOT 專家設定
const experts = ref([]);
const selectedLineExpert = ref("");
const searchInput = ref("");
const displayExperts = computed(() => {
    return experts.value.filter((expert) => expert.name.match(searchInput.value));
});
const savingLineExpert = ref(false);
async function changeLineExpert() {
    savingLineExpert.value = true;
    const body = { expertID: selectedLineExpert.value };
    const response = await updateLineExpert(body);
    if (response.data.code === 0) {
        emitter.emit("openSnackbar", { message: "變更成功", color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: "變更失敗", color: "error" });
    }
    savingLineExpert.value = false; 
}

// 顯示別人也在問
const otherAlsoAsk = ref([
    {
        value: true,
        name: "顯示",
    },
    {
        value: false,
        name: "不顯示",
    },
]);
const displayOtherAlsoAsk = ref(false);
const savingOtherAlsoAsk = ref(false);
async function changeOtherAlsoAsk() {
    savingOtherAlsoAsk.value = true;
    const body = { 
        other_also_ask: displayOtherAlsoAsk.value,
    };
    const response = await updateLineSetting(body);
    if (response.data.code === 0) {
        emitter.emit("openSnackbar", { message: "儲存成功", color: "success" });
        getData();
    } else {
        emitter.emit("openSnackbar", { message: "儲存失敗", color: "error" });
    }
    savingOtherAlsoAsk.value = false;
}

// LINE BOT 顏色設定
const colors = ref({
    textColor: "",
    aTagColor: "",
    boldColor: "",
    backgroundColor: "",
});
// 顏色選擇器顯示
const colorPickers = ref({
    textColor: false,
    aTagColor: false,
    boldColor: false,
    backgroundColor: false,
});
// 調色盤預設顏色
const swatches = [
    ["#FF0000", "#AA0000", "#550000"],
    ["#FFFF00", "#AAAA00", "#555500"],
    ["#00FF00", "#00AA00", "#005500"],
    ["#00FFFF", "#00AAAA", "#005555"],
    ["#0000FF", "#0000AA", "#000055"],
];
// 控制顏色選擇器的顯示
const handleColorPickerVisibility = (section, value) => {
    colorPickers.value[section] = value;
};
// 更新顏色
const handleColorUpdate = (section, color) => {
    colors.value[section] = color;
};
// 清單樣式
const defaultListStyle = ref([
    ["•", "◦", "▪︎"],
    ["★", "☆", "✦"],
    ["➤", "➥", "➦"],
    ["◼︎", "◼︎", "◼︎"],
    ["◻︎", "◻︎", "◻︎"],
    ["▪", "▪︎", "▪︎"],
]);
const listStyles = ref([]);

// 儲存設定
const saveLoading = ref(false);
async function saveLineSetting() {
    saveLoading.value = true;
    const data = {
        text_color: colors.value.textColor,
        a_tag_color: colors.value.aTagColor,
        bold_color: colors.value.boldColor,
        background_color: colors.value.backgroundColor,
        ul_marks: listStyles.value,
    };

    const response = await updateLineSetting(data);
    if (response.data.code === 0) {
        emitter.emit("openSnackbar", { message: "儲存成功", color: "success" });
        getData();
    } else {
        emitter.emit("openSnackbar", { message: "儲存失敗", color: "error" });
    }
    saveLoading.value = false;
}

// 重置為預設值
function resetToDefault() {
    colors.value.textColor = "#292929";
    colors.value.aTagColor = "#0367D3";
    colors.value.boldColor = "#292929";
    colors.value.backgroundColor = "#ffffff";
    listStyles.value = ['•', '◦', '▪︎'];
}

// 還原
function resetToOriginal() {
    const lineSettings = JSON.parse(basicData.value.lineSettings);
    colors.value.textColor = lineSettings.text_color;
    colors.value.aTagColor = lineSettings.a_tag_color;
    colors.value.boldColor = lineSettings.bold_color;
    colors.value.backgroundColor = lineSettings.background_color;
    listStyles.value = lineSettings.ul_marks;
}
</script>

<template>
    <div class="bulletin_view">
        <!-- 選擇專家 -->
        <div class="list d-flex text-no-wrap">
            <p class="mt-3 mr-3 text-h6">LINE BOT 專家</p>
            <v-select
                :items="displayExperts"
                label="選擇專家"
                item-value="id"
                item-title="name"
                v-model="selectedLineExpert"
                @update:modelValue="changeLineExpert()"
                no-data-text="查無專家"
                clearable
                :loading="savingLineExpert"
            >
                <template v-slot:prepend-item>
                    <v-list-item>
                        <template v-slot:prepend>
                            <v-text-field
                                clearable
                                label="搜尋專家"
                                prepend-icon="mdi-magnify"
                                variant="outlined"
                                hide-details
                                width="300"
                                v-model="searchInput"
                            ></v-text-field>
                        </template>
                    </v-list-item>

                    <v-divider class="mt-2"></v-divider>
                </template>
            </v-select>
        </div>
        <!-- 別人也在問 -->
        <div class="list d-flex text-no-wrap">
            <p class="mt-3 mr-3 text-h6">顯示別人也在問</p>
            <v-select
                :items="otherAlsoAsk"
                item-value="value"
                item-title="name"
                v-model="displayOtherAlsoAsk"
                :loading="savingOtherAlsoAsk"
                @update:modelValue="changeOtherAlsoAsk()"
            >
            </v-select>
        </div>
        <!-- Line Bot 顏色設定 -->
        <v-card>           
            <v-card-text>
                <v-row>
                    <v-col cols="12" md="6" lg="4" xl="3">
                        <div>
                            <div class="mb-4 d-flex align-center">
                                <v-icon icon="mdi-message-text" color="primary" class="mr-2"></v-icon>
                                <span class="text-subtitle-1 font-weight-medium">聊天室樣式設定</span>
                                <v-btn class="ml-auto" prepend-icon="mdi-content-save" color="primary" variant="tonal" @click="saveLineSetting()"
                                    :loading="saveLoading"
                                    :disabled="loadingData"
                                    >保存修改</v-btn
                                >
                            </div>
                            <v-divider class="mb-4"></v-divider>
                            <div class="px-2">
                                <!-- 機器人對話內容 -->
                                <div v-if="!firstLoad">
                                    <div class="mb-2 d-flex align-center justify-space-between">
                                        <v-chip color="primary" size="small" variant="flat"
                                            >機器人對話內容</v-chip
                                        >
                                        <div>
                                            
                                            <v-btn
                                                class="mr-2"
                                                color="primary"
                                                variant="tonal"
                                                size="small"
                                                @click="resetToOriginal()"
                                            >
                                                還原
                                            </v-btn>
                                            <v-btn
                                                
                                                color="secondary"
                                                variant="tonal"
                                                size="small"
                                                @click="resetToDefault()"
                                            >
                                                使用預設
                                            </v-btn>
                                        </div>
                                    </div>
                                    <ColorPicker
                                        label="字體顏色"
                                        :color-value="colors.textColor"
                                        :color-picker-value="colorPickers.textColor"
                                        :swatches="swatches"
                                        class="mb-2"
                                        @update:color="(color) => handleColorUpdate('textColor', color)"
                                        @update:color-picker-value="
                                            (value) => handleColorPickerVisibility('textColor', value)
                                        "
                                    />
                                    <ColorPicker
                                        label="連結顏色"
                                        :color-value="colors.aTagColor"
                                        :color-picker-value="colorPickers.aTagColor"
                                        :swatches="swatches"
                                        class="mb-4"
                                        @update:color="(color) => handleColorUpdate('aTagColor', color)"
                                        @update:color-picker-value="
                                            (value) => handleColorPickerVisibility('aTagColor', value)
                                        "
                                    />
                                    <ColorPicker
                                        label="粗體顏色"
                                        :color-value="colors.boldColor"
                                        :color-picker-value="colorPickers.boldColor"
                                        :swatches="swatches"
                                        class="mb-4"
                                        @update:color="(color) => handleColorUpdate('boldColor', color)"
                                        @update:color-picker-value="
                                            (value) => handleColorPickerVisibility('boldColor', value)
                                        "
                                    />
                                    <ColorPicker
                                        label="背景顏色"
                                        :color-value="colors.backgroundColor"
                                        :color-picker-value="colorPickers.backgroundColor"
                                        :swatches="swatches"
                                        class="mb-4"
                                        @update:color="(color) => handleColorUpdate('backgroundColor', color)"
                                        @update:color-picker-value="
                                            (value) => handleColorPickerVisibility('backgroundColor', value)
                                        "
                                    />
                                    <div class="position-relative d-flex align-center">
                                        <p class="text-caption list-icon-title">項目符號 :</p>
                                        <v-text-field
                                            v-model="listStyles"
                                            type="text"
                                            variant="filled"
                                            density="compact"
                                            hide-details
                                            readonly
                                        >
                                        </v-text-field>
                                        <div class="list-menu-btn">
                                            <v-icon
                                                class="list-menu-icon"
                                                icon="mdi-format-list-bulleted-type"
                                                size="large"
                                            ></v-icon>
                                            <v-menu activator="parent">
                                                <div class="list-menu">
                                                    <div class="list-menu-item" v-for="(item, index) in defaultListStyle" :key="index" @click="listStyles = item">
                                                        <p class="first-item d-flex align-center">
                                                            <span class="tag">{{ item[0] }}</span>
                                                            <div class="list-menu-item-content"></div>
                                                        </p>
                                                        <p class="second-item d-flex align-center">
                                                            <span class="tag">{{ item[1] }}</span>
                                                            <div class="list-menu-item-content"></div>
                                                        </p>
                                                        <p class="second-item d-flex align-center">
                                                            <span class="tag">{{ item[1] }}</span>
                                                            <div class="list-menu-item-content"></div>
                                                        </p>
                                                        <p class="third-item d-flex align-center">
                                                            <span class="tag">{{ item[2] }}</span>
                                                            <div class="list-menu-item-content"></div>
                                                        </p>
                                                        <p class="first-item d-flex align-center">
                                                            <span class="tag">{{ item[0] }}</span>
                                                            <div class="list-menu-item-content"></div>
                                                        </p>
                                                    </div>
                                                </div>
                                            </v-menu>
                                        </div>
                                    </div>
                                </div>
                                <div v-else>
                                    <v-skeleton-loader type="article"></v-skeleton-loader>
                                </div>
                            </div>
                        </div>
                    </v-col>
                    <v-col cols="12" md="6" lg="4" xl="3">
                        <v-card>
                            <v-card-title>聊天室預覽</v-card-title>
                            <v-card-text>
                                <div class="line-preview-container">
                                    <div class="user-message-container">
                                        <div class="time-tag">上午 9:10</div>
                                        <div class="user-message">
                                            身分證掉了怎麼辦
                                            <div class="user-message-triangle"></div>
                                        </div>
                                    </div>

                                    <div class="bot-message">
                                        <v-avatar class="mb-1" size="small" color="primary" variant="tonal">
                                            <v-icon icon="mdi-robot" color="white"></v-icon>
                                        </v-avatar>
                                        <div
                                            class="bot-message-content"
                                            :style="{
                                                backgroundColor: colors.backgroundColor,
                                                color: colors.textColor,
                                            }"
                                        >
                                            <p>
                                                您好，我理解您對<strong :style="{ color: colors.boldColor }"
                                                    >身分證遺失</strong
                                                >的困擾。針對這個問題，我們可以這樣協助您 :
                                            </p>
                                            <ul>
                                                <li>
                                                    <strong :style="{ color: colors.boldColor }">
                                                        <span class="mr-2">{{ listStyles[0] }}</span
                                                        >電話申請
                                                    </strong>
                                                    <ul class="pl-4">
                                                        <li>
                                                            <span class="mr-2">{{ listStyles[1] }}</span
                                                            >上班時間親自或以電話向全國任一戶政事務所申請。
                                                        </li>
                                                        <li>
                                                            <span class="mr-2">{{ listStyles[1] }}</span
                                                            >非上班時間由本人親自以電話向內政部戶政司辦理掛失。
                                                            <ul class="pl-6">
                                                                <li>
                                                                    <span class="mr-2">{{ listStyles[2] }}</span
                                                                    >市話: 07-7123456
                                                                </li>
                                                                <li>
                                                                    <span class="mr-2">{{ listStyles[2] }}</span
                                                                    >手機: 0912345678
                                                                </li>
                                                            </ul>
                                                        </li>
                                                    </ul>
                                                </li>
                                            </ul>
                                            <p>
                                                📖 資料來源 :
                                                <span
                                                    :style="{ color: colors.aTagColor, cursor: 'pointer' }"
                                                    >苓雅區戶政事務所</span
                                                >
                                            </p>
                                        </div>
                                        <div class="time-tag text-end">上午 9:11</div>
                                    </div>
                                </div>
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>
            </v-card-text>
        </v-card>
    </div>
</template>

<style lang="scss" scoped>
.bulletin_view {
    padding: 2rem;
    width: 100%;
    height: 100%;

    .list {
        min-width: 500px;
        max-width: 800px;
    }
}

.line-preview-container {
    max-width: 430px;
    aspect-ratio: 1/1.5;
    background-color: #aabbe6;
    padding: 20px 15px 10px 10px;
}

.user-message-container {
    display: flex;
    align-items: end;
    justify-content: flex-end;
    gap: 5px;
    .user-message {
        background-color: #c4f69d;
        padding: 5px 10px;
        border-radius: 20px;
        max-width: 70%;
        width: fit-content;
        position: relative;
        .user-message-triangle {
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-bottom: 15px solid #c4f69d;
            transform: rotate(45deg);
            position: absolute;
            top: -3px;
            right: -5px;
        }
    }
}

.bot-message {
    max-width: 72%;
}

.bot-message-content {
    background-color: #fff;
    padding: 10px;
    border-radius: 10px;
    margin-bottom: 10px;
}

.time-tag {
    font-size: 12px;
    color: #838383;
}

.list-icon-title {
    min-width: 80px;
    margin-right: 8px;
}

.list-menu-btn {
    width: 36px;
    aspect-ratio: 1/1;
    border-radius: 4px;
    background-color: #eeeeee;
    margin-left: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    &:hover {
        background-color: #e0e0e0;
    }
    .list-menu-icon {
        transition: all 0.3s ease;
        &:hover {
            scale: 1.1;
        }
    }
}

.list-menu {
    background-color: white;
    padding: 8px;
    border-radius: 4px;
    max-width: 280px;
    box-shadow: 0 0 5px 5px rgba(0, 0, 0, 0.1);
    display: flex;
    justify-content: space-evenly;
    flex-wrap: wrap;
    gap: 8px;
    .list-menu-item {
        padding: 4px;
        width: 80px;
        border-radius: 4px;
        border: 1px solid #e0e0e0;
        cursor: pointer;
        &:hover {
            background-color: #f0f0f0;
        }
        .tag {
            margin-right: 4px;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
        }   
        .list-menu-item-content {
            flex: 1;
            height: 4px;
            background-color: #a9a9a9;
        }
        .second-item {
            margin-left: 16px;
            
        }
        .third-item {
            margin-left: 32px;
            
        }
    }
}

</style>
