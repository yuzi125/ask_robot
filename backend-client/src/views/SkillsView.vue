<script setup>
import { ref, onMounted, inject, computed, watch, nextTick } from "vue";
import FormComponents from "../components/FormComponents.vue";
import { useStateStore } from "../store/index";
import { storeToRefs } from "pinia";
import { useVirtualizer } from "@tanstack/vue-virtual";

const stateStore = useStateStore();
const { datasetsIcon, skillsIcon } = storeToRefs(stateStore);

const axios = inject("axios");
const emitter = inject("emitter");

// 設定每行顯示的卡片數量 (響應式)
const cardsPerRow = ref(4); // 預設值，會根據螢幕寬度自動調整
const ROW_HEIGHT = 220; // 每行高度
const searchQuery = ref("");
const isLoading = ref(true);
const isError = ref(false);
const error = ref(null);

onMounted(() => {
    getSkills();
    getPresetSkillConfig();
    updateCardsPerRow(); // 初始化時計算
    window.addEventListener("resize", updateVirtualizer);
});

const skillCards = ref([]);
async function getSkills() {
    try {
        isLoading.value = true;
        const rs = await axios.get("/skill/skill");
        if (rs.data.code === 0) {
            skillCards.value = rs.data.data;
        } else {
            emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
            isError.value = true;
            error.value = new Error(rs.data.message);
        }
    } catch (err) {
        isError.value = true;
        error.value = err;
        emitter.emit("openSnackbar", { message: err.message, color: "error" });
    } finally {
        isLoading.value = false;
    }
}

const preset_skill_config = ref("");
function getPresetSkillConfig() {
    axios.get("/skill/preset_skill_config").then((rs) => {
        if (rs.data.code === 0) {
            preset_skill_config.value = rs.data.data;
        } else {
            emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
        }
    });
}

// 虛擬滾動相關
const scrollContainerRef = ref(null);

// 自動調整每行顯示的卡片數量
const updateCardsPerRow = () => {
    const containerWidth = scrollContainerRef.value?.clientWidth || window.innerWidth;

    // 根據容器寬度動態調整每行卡片數量
    if (containerWidth > 1800) {
        cardsPerRow.value = 6; // 大螢幕顯示6個
    } else if (containerWidth > 1500) {
        cardsPerRow.value = 5; // 中等大螢幕顯示5個
    } else if (containerWidth > 1200) {
        cardsPerRow.value = 4; // 標準螢幕顯示4個
    } else if (containerWidth > 900) {
        cardsPerRow.value = 3; // 小螢幕顯示3個
    } else if (containerWidth > 600) {
        cardsPerRow.value = 2; // 平板顯示2個
    } else {
        cardsPerRow.value = 1; // 手機顯示1個
    }
};

// 根據搜尋過濾數據
const filteredSkills = computed(() => {
    if (!skillCards.value || skillCards.value.length === 0) return [];

    if (!searchQuery.value.trim()) {
        return skillCards.value;
    }

    const query = searchQuery.value.toLowerCase();
    return skillCards.value.filter(
        (skill) =>
            skill.name?.toLowerCase().includes(query) ||
            skill.describe?.toLowerCase().includes(query) ||
            skill.class?.toLowerCase().includes(query)
    );
});

// 將"上架新技能"按鈕納入計算，創建一個合併的數據源
const combinedData = computed(() => {
    if (!filteredSkills.value) return [];

    let result = [...filteredSkills.value];

    // 添加新技能按鈕
    result.unshift({ id: "add-card", isAddCard: true });

    return result;
});

// 將數據分為行
const rows = computed(() => {
    if (!combinedData.value.length) return [];

    const rowCount = Math.ceil(combinedData.value.length / cardsPerRow.value);
    const result = [];

    for (let i = 0; i < rowCount; i++) {
        const startIdx = i * cardsPerRow.value;
        const endIdx = Math.min(startIdx + cardsPerRow.value, combinedData.value.length);
        result.push(combinedData.value.slice(startIdx, endIdx));
    }

    return result;
});

// 設置虛擬滾動 (基於行)
const rowVirtualizer = computed(() => {
    if (!rows.value.length) return null;

    return useVirtualizer({
        count: rows.value.length,
        getScrollElement: () => scrollContainerRef.value,
        estimateSize: () => ROW_HEIGHT, // 每行的高度
        overscan: 3, // 預加載的行數
    });
});

// 獲取虛擬行
const virtualRows = computed(() => {
    return rowVirtualizer.value?.value?.getVirtualItems() || [];
});

// 總高度
const totalHeight = computed(() => {
    return rowVirtualizer.value?.value?.getTotalSize() || 0;
});

// 卡片寬度計算 (考慮內容寬度，確保卡片不被截斷)
const cardWidth = computed(() => {
    const containerWidth = scrollContainerRef.value?.clientWidth || 1200;
    // 減去padding和margin的空間
    const availableWidth = containerWidth - 80;
    return availableWidth / cardsPerRow.value - 16; // 每個卡片減去margin
});

// 當容器大小變化時，重新計算虛擬滾動
const updateVirtualizer = () => {
    updateCardsPerRow();
    nextTick(() => {
        rowVirtualizer.value?.value?.measure();
    });
};

const previousCardsPerRow = ref(cardsPerRow.value);
watch(cardsPerRow, (newValue) => {
    // 解決點同一個兩次的話，會變成undefined的問題
    if (newValue === null || newValue === undefined) {
        cardsPerRow.value = previousCardsPerRow.value;
    } else {
        previousCardsPerRow.value = newValue;
    }

    // 當cardsPerRow變化時，重新計算虛擬滾動
    nextTick(() => {
        rowVirtualizer.value?.value?.measure();
    });
});

const addSkillBtn = ref({
    header: "上架新技能",
    description: "導入您自己的api",
});

const formUpdateRef = ref(null);
function openUpdateForm() {
    let title = "修改技能";
    let placeholder = "";
    let data = [
        { type: "text", name: "icon", required: false, placeholder: "icon圖示(fontawesome class)" },
        { type: "text", name: "name", required: true, placeholder: "技能名稱" },
        { type: "text", name: "class_name", required: true, placeholder: "技能class" },
        { type: "textarea", name: "describe", required: true, placeholder: "技能描述", rows: 3 },
        { type: "textarea", name: "config_jsonb", required: true, placeholder: "json設定", isJson: true },
    ];
    formUpdateRef.value.open({ title, placeholder, data });
}
function getSkill(skill_id) {
    axios.get(`/skill/skill?skill_id=${skill_id}`).then((rs) => {
        if (rs.data.code === 0) {
            rs = rs.data.data[0];
            const obj = {
                skill_id: rs.id,
                icon: rs.icon,
                name: rs.name,
                class_name: rs.class,
                describe: rs.describe,
                config_jsonb: JSON.stringify(rs.config_jsonb),
                experts: rs.Experts,
            };
            formUpdateRef.value.setFormData(obj);
            openUpdateForm();
        } else {
            emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
        }
    });
}
async function updateSkill(data) {
    if (!isValidJSON(data.config_jsonb)) {
        emitter.emit("openSnackbar", { message: "請輸入json格式", color: "error" });
        return;
    }
    if (data.name.length > 50) {
        emitter.emit("openSnackbar", { message: "技能名稱過長，請適當縮短以符合系統規範", color: "error" });
        return;
    }

    formUpdateRef.value.close();
    let rs = await axios.put(
        "/skill/skill",
        JSON.stringify({
            skill_id: data.skill_id,
            icon: data.icon,
            name: data.name,
            class_name: data.class_name,
            describe: data.describe,
            config_jsonb: data.config_jsonb,
        })
    );
    if (rs.data.code === 0) {
        getSkills();
        emitter.emit("openSnackbar", { message: "修改成功", color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
}
async function deleteSkill(data) {
    formUpdateRef.value.close();
    console.log("data: ", data.skill_id);
    let rs = await axios.delete("/skill/skill", {
        data: {
            skill_id: data.skill_id,
        },
    });
    if (rs.data.code === 0) {
        getSkills();
        emitter.emit("openSnackbar", { message: "刪除成功", color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
}

const formRef = ref(null);
function openForm() {
    let title = "開始建立一個技能";
    let placeholder = "";
    let data = [
        { type: "text", name: "icon", required: false, placeholder: "icon圖示(fontawesome class)" },
        { type: "text", name: "name", required: true, placeholder: "技能名稱" },
        { type: "text", name: "class_name", required: true, placeholder: "技能class" },
        { type: "textarea", name: "describe", required: true, placeholder: "技能描述", rows: 3 },
        { type: "textarea", name: "config_jsonb", required: true, placeholder: "json設定", isJson: true },
    ];
    formRef.value.setFormData({ config_jsonb: JSON.stringify(preset_skill_config.value) });
    formRef.value.open({ title, placeholder, data });
}

//檢查是否為json字串
function isValidJSON(JsonStr) {
    try {
        const obj = JSON.parse(JsonStr);
        if (typeof obj === "object" && obj) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        return false;
    }
}
async function createSkill(data) {
    if (!isValidJSON(data.config_jsonb)) {
        emitter.emit("openSnackbar", { message: "請輸入json格式", color: "error" });
        return;
    }
    if (data.name.length > 50) {
        emitter.emit("openSnackbar", { message: "技能名稱過長，請適當縮短以符合系統規範", color: "error" });
        return;
    }

    formRef.value.close();
    let rs = await axios.post(
        "/skill/create",
        JSON.stringify({
            icon: data.icon,
            name: data.name,
            class_name: data.class_name,
            describe: data.describe,
            config_jsonb: data.config_jsonb,
        })
    );
    if (rs.data.code === 0) {
        getSkills();
        emitter.emit("openSnackbar", { message: "創建成功", color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
}
</script>

<template>
    <div class="skills_view">
        <!-- 搜尋和控制區域 -->
        <div class="control-panel">
            <div class="search-container">
                <div class="search-input-wrapper">
                    <i class="fa-solid fa-magnifying-glass search-icon"></i>
                    <input type="text" v-model="searchQuery" class="search-input" placeholder="搜尋技能..." />
                    <v-btn
                        v-if="searchQuery"
                        @click="searchQuery = ''"
                        variant="text"
                        density="compact"
                        icon="fa-solid fa-times"
                        size="small"
                        class="clear-button"
                    ></v-btn>
                </div>
            </div>
            <div class="layout-controls">
                <div class="view-mode-label">顯示模式</div>
                <v-btn-toggle v-model="cardsPerRow" color="primary" density="comfortable" class="grid-toggle">
                    <v-btn :value="2" variant="text" class="grid-btn">
                        <i class="fa-solid fa-table-cells-large"></i>
                    </v-btn>
                    <v-btn :value="4" variant="text" class="grid-btn">
                        <i class="fa-solid fa-table-cells"></i>
                    </v-btn>
                    <v-btn :value="6" variant="text" class="grid-btn">
                        <i class="fa-solid fa-grip"></i>
                    </v-btn>
                </v-btn-toggle>
            </div>
        </div>

        <div class="scroll-container" ref="scrollContainerRef">
            <template v-if="isLoading">
                <v-row class="d-flex justify-space-between">
                    <v-col v-for="n in 4" :key="n" cols="12" sm="6" md="4" lg="3">
                        <v-skeleton-loader type="image, list-item-two-line" />
                    </v-col>
                </v-row>
            </template>

            <!-- 虛擬滾動容器 -->
            <div v-else-if="rows.length > 0" class="virtual-list-container" :style="{ height: `${totalHeight}px` }">
                <div
                    v-for="virtualRow in virtualRows"
                    :key="virtualRow.index"
                    class="row"
                    :style="{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${ROW_HEIGHT}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                    }"
                >
                    <!-- 每行的卡片 -->
                    <div
                        v-for="(item, colIndex) in rows[virtualRow.index]"
                        :key="item.id || colIndex"
                        class="col"
                        :style="{
                            width: `${cardWidth}px`,
                            flex: `0 0 ${cardWidth}px`,
                        }"
                    >
                        <!-- 新增技能卡片 -->
                        <div v-if="item.isAddCard" class="card add_card" @click="openForm">
                            <div class="card_top add_card_top">
                                <span><i class="fa-solid fa-plus"></i></span>
                                <p>{{ addSkillBtn.header }}</p>
                            </div>
                            <div class="card_center add_card_center">
                                <p>{{ addSkillBtn.description }}</p>
                            </div>
                        </div>

                        <!-- 技能卡片 -->
                        <template v-else>
                            <v-tooltip
                                location="top"
                                :disabled="
                                    !(
                                        item.created_by_name ||
                                        item.created_by ||
                                        item.updated_by_name ||
                                        item.updated_by
                                    )
                                "
                                :text="
                                    (item.created_by_name || item.created_by
                                        ? `建立者：${item.created_by_name || item.created_by}`
                                        : '') +
                                    (item.updated_by_name || item.updated_by
                                        ? `更新者：${item.updated_by_name || item.updated_by}`
                                        : '')
                                "
                            >
                                <template v-slot:activator="{ props }">
                                    <div class="card" v-bind="props" @click="getSkill(item.id)">
                                        <div class="card_top">
                                            <span><i :class="item.icon || skillsIcon"></i></span>
                                            <p>{{ item.name }}</p>
                                        </div>
                                        <div class="card_center">
                                            <p class="class-name">class: {{ item.class }}</p>
                                            <p class="description text-truncate">{{ item.describe }}</p>
                                        </div>
                                        <div class="card_bottom">
                                            <div class="item">
                                                <span><i class="fa-solid fa-diagram-project"></i></span>
                                                <p>{{ item.Experts?.length || 0 }}關聯專家</p>
                                                <v-tooltip
                                                    v-for="(expert, index) in item.Experts || []"
                                                    :key="'expert' + index"
                                                    :text="expert.name"
                                                    location="top"
                                                >
                                                    <template v-slot:activator="{ props }">
                                                        <img
                                                            v-show="index < 3"
                                                            v-bind="props"
                                                            :src="expert.avatar"
                                                            alt=""
                                                        />
                                                    </template>
                                                </v-tooltip>
                                                <span
                                                    v-if="item.Experts && item.Experts.length > 3"
                                                    class="other-expert-count"
                                                    >{{ `(+${item.Experts.length - 3})` }}
                                                    <v-tooltip activator="parent" location="top">{{
                                                        item.Experts.slice(3)
                                                            .map((expert) => expert.name)
                                                            .join("、")
                                                    }}</v-tooltip></span
                                                >
                                            </div>
                                        </div>
                                    </div>
                                </template>
                            </v-tooltip>
                        </template>
                    </div>
                </div>
            </div>

            <div v-else-if="isLoading" class="status-message">
                <v-progress-circular indeterminate color="primary"></v-progress-circular>
                <div class="mt-3">正在載入技能列表...</div>
            </div>
            <div v-else-if="isError" class="status-message">
                <v-icon color="error" size="large">fa-solid fa-triangle-exclamation</v-icon>
                <div class="mt-3">載入失敗: {{ error?.message }}</div>
            </div>
            <div v-else-if="searchQuery && filteredSkills.length === 0" class="status-message">
                <v-icon color="info" size="large">fa-solid fa-search</v-icon>
                <div class="mt-3">沒有符合 "{{ searchQuery }}" 的技能</div>
            </div>
            <div v-else-if="skillCards.length === 0" class="status-message">
                <v-icon color="info" size="large">fa-solid fa-code</v-icon>
                <div class="mt-3">目前沒有技能，請點擊"上架新技能"按鈕創建一個新技能。</div>
            </div>
        </div>

        <FormComponents ref="formRef" @send="createSkill"></FormComponents>
        <FormComponents ref="formUpdateRef" :showDeleteButton="true" @delete="deleteSkill" @send="updateSkill">
        </FormComponents>
    </div>
</template>

<style lang="scss" scoped>
$color1: rgb(106, 174, 233);
$color2: rgb(104, 197, 127);
$color3: rgb(139, 139, 139);
$primary-color: #1c64f1;
$light-gray: #f9fafb;
$border-color: #e0e0e0;

.datasets {
    color: $color1 !important;
}

.skill {
    color: $color2 !important;
}

.skills_view {
    position: relative;
    height: calc(100vh - 75px);
    width: 100%;
    overflow: hidden;
    padding: 1rem 2rem;
}

.control-panel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
    padding: 0.5rem 1rem;
    flex-wrap: wrap;
    gap: 1rem;
    background-color: white;
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.search-container {
    flex: 1;
    max-width: 500px;
}

.search-input-wrapper {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
    background-color: $light-gray;
    border-radius: 8px;
    padding: 0.1rem 0.5rem;
    border: 1px solid $border-color;
    transition: all 0.2s;

    &:focus-within {
        border-color: $primary-color;
        box-shadow: 0 0 0 2px rgba($primary-color, 0.1);
    }
}

.search-input {
    width: 100%;
    padding: 0.7rem 0.5rem;
    border: none;
    font-size: 0.95rem;
    background-color: transparent;

    &:focus {
        outline: none;
    }
}

.search-icon {
    color: #6b7280;
    font-size: 0.9rem;
    margin-right: 0.5rem;
}

.clear-button {
    margin-left: auto;
}

.layout-controls {
    display: flex;
    align-items: center;
    gap: 0.7rem;
}

.view-mode-label {
    font-size: 0.9rem;
    color: #6b7280;
    margin-right: 0.3rem;
}

.grid-toggle {
    border: 1px solid $border-color;
    border-radius: 8px;
    overflow: hidden;
}

.grid-btn {
    min-width: 42px;
    width: 42px;
}

.scroll-container {
    height: calc(100% - 70px);
    width: 100%;
    overflow-y: auto;
    overflow-x: hidden;
}

.virtual-list-container {
    position: relative;
    width: 100%;
}

.row {
    display: flex;
    flex-wrap: nowrap;
    width: 100%;
    gap: 1rem;
    padding: 0 0.5rem;
}

.col {
    margin-bottom: 1rem;
}

.card {
    width: 100%;
    border-radius: 0.7rem;
    background-color: white;
    cursor: pointer;
    transition: 0.25s;
    padding: 1rem;
    box-shadow: 0px 1px 5px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    height: 190px;
    box-sizing: border-box;
    overflow: hidden;
    position: relative;
    border: 3px solid rgba($color: $color2, $alpha: 0.5);

    &:hover {
        box-shadow: 0px 8px 15px rgba($color: $color2, $alpha: 0.3);
        border: 3px solid rgba($color: $color2, $alpha: 0.7);
    }

    .card_top {
        display: flex;
        align-items: center;
        height: 40px;
        margin-bottom: 0.5rem;

        img {
            width: 2rem;
            height: 2rem;
            border-radius: 0.5rem;
            margin-right: 0.6rem;
            border: 1px solid #e4e5e7;
        }
        span {
            width: 2rem;
            height: 2rem;
            border-radius: 0.5rem;
            margin-right: 0.6rem;
            border: 1px solid #e4e5e7;
            display: flex;
            justify-content: center;
            align-items: center;
            color: $color2;
        }
    }

    .card_center {
        color: #6b7280;
        font-size: 0.85rem;
        line-height: 1.4;
        margin-bottom: 0.7rem;
        flex: 1;
        display: flex;
        flex-direction: column;

        .class-name {
            margin-bottom: 0.3rem;
            word-break: break-all;
            font-size: 0.85rem;
            color: #333;
        }

        .description {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }
    }

    .card_bottom {
        color: #6b7280;
        font-size: 0.8rem;
        display: flex;
        flex-wrap: wrap;
        margin-top: auto;

        .item {
            display: flex;
            align-items: center;
            flex-wrap: wrap;

            span {
                color: #98a2b3;
                margin-right: 0.3rem;
                font-size: 0.8rem;
            }

            p {
                margin-right: 1rem;
                margin-bottom: 0.5rem;
                margin-top: 0.2rem;
                white-space: nowrap;
            }

            img {
                width: 1.5rem;
                height: 1.5rem;
                border-radius: 0.5rem;
                margin-right: 0.6rem;
                border: 1px solid #e4e5e7;
            }

            .other-expert-count {
                font-size: 0.75rem;
                color: #6b7280;
            }
        }
    }
}

.add_card {
    background-color: #eceef1;
    border: 2px solid rgba($color: $color2, $alpha: 0.3);

    &:hover {
        background-color: white;
        box-shadow: 0px 8px 10px rgba($color: $color2, $alpha: 0.3);
        border: 2px solid rgba($color: $color2, $alpha: 0.5);
    }

    .add_card_top {
        span {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 2rem;
            height: 2rem;
            color: #6b7280;
            font-size: 0.5rem;
            border: 1px solid #e4e5e7;
            background-color: #f3f4f6;
            border-radius: 0.5rem;
            margin-right: 0.6rem;
        }
    }
}

.status-message {
    text-align: center;
    padding: 5rem 1rem;
    font-size: 1.1rem;
    color: #666;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.text-truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
