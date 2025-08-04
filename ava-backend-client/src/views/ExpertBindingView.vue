<script setup>
import { ref, onMounted, inject, computed, reactive, toRef, watchEffect } from "vue";
import { useRoute } from "vue-router";
import { useStateStore } from "../store/index";
import { storeToRefs } from "pinia";
import { useQueryClient, useQuery } from "@tanstack/vue-query";
import { fetchBindList } from "@/network/service";
const stateStore = useStateStore();
const { datasetsIcon, skillsIcon } = storeToRefs(stateStore);

import ConfirmComponents from "@/components/ConfirmComponents.vue";

const props = defineProps({
    data: { type: Object, default: {} },
});

const route = useRoute();
const axios = inject("axios");
const emitter = inject("emitter");
const queryClient = useQueryClient();

const expert_id = route.params.expert_id;

// 取得綁定的知識庫&技能
const { data: bindListQueryData } = useQuery({
    queryKey: ["bindList", expert_id],
    queryFn: () => fetchBindList(expert_id),
});

// 綁定的知識庫和技能 讓資料變成可以更改的
const binds = computed(() => {
    const bindsData = bindListQueryData.value?.binds || [];
    return reactive(bindsData.map((item) => ({ ...item })));
});

// 知識庫 讓資料變成可以更改的
const datasets = computed(() => {
    const datasetsData = bindListQueryData.value?.datasets || [];
    return reactive(datasetsData.map((item) => ({ ...item })));
});

// 技能 讓資料變成可以更改的
const skill = computed(() => {
    const skillData = bindListQueryData.value?.skill || [];
    return reactive(skillData.map((item) => ({ ...item })));
});

const bind_dom = ref(null);

function handleDragstart(e) {
    e.dataTransfer.setData("text", e.target.id);
}
function handleDragover(e) {
    e.preventDefault();
    bind_dom.value.classList.add("dragover");
}
function handleDragleave(e) {
    e.preventDefault();
    bind_dom.value.classList.remove("dragover");
}

function handleDrop(e) {
    e.preventDefault();
    bind_dom.value.classList.remove("dragover");
    const id = e.dataTransfer.getData("text");
    const datasets_index = datasets.value.findIndex((f) => f.datasets_id === id);
    const skill_index = skill.value.findIndex((f) => f.skill_id === id);
    if (datasets_index !== -1) {
        let temp = datasets.value.splice(datasets_index, 1);
        temp[0].update = true;
        binds.value.push(temp[0]);
    }
    if (skill_index !== -1) {
        let temp = skill.value.splice(skill_index, 1);
        temp[0].update = true;
        binds.value.push(temp[0]);
    }
}
function handleBind(item, index) {
    if (item.datasets_id) {
        let temp = datasets.value.splice(index, 1);
        temp[0].update = true;
        binds.value.push(temp[0]);
    }
    if (item.skill_id) {
        let temp = skill.value.splice(index, 1);
        temp[0].update = true;
        binds.value.push(temp[0]);
    }
}
function delBind(item) {
    const index = binds.value.findIndex(
        (bind) => bind.datasets_id === item.datasets_id && bind.skill_id === item.skill_id
    );
    if (index !== -1) {
        binds.value[index].del = !binds.value[index].del;
    }
}
function handleCancelBind(index) {
    let temp = binds.value.splice(index, 1);
    delete temp[0].update;
    if (temp[0].datasets_id) {
        datasets.value.push(temp[0]);
    }
    if (temp[0].skill_id) {
        skill.value.push(temp[0]);
    }
}

// function handleAllDragover(e) {
//     e.preventDefault();
// }
// function handleAllDrop(e) {
//     e.preventDefault();
//     const id = e.dataTransfer.getData("text");
//     const binds_index = binds.value.findIndex((f) => f.datasets_id === id || f.skill_id === id);
//     let item = binds.value[binds_index];
//     if (item.update) {
//         item.del = true;
//     } else {
//         item = binds.value.splice(binds_index, 1);
//         item = item[0];
//         delete item.update;
//         if (item.datasets_id) {
//             datasets.value.push(item);
//         }
//         if (item.skill_id) {
//             skill.value.push(item);
//         }
//     }
// }

const hasUpdate = computed(() => {
    console.log("hasUPdate", binds.value);
    let update_num = binds.value.filter((f) => f.update).length;
    let delete_num = binds.value.filter((f) => f.del).length;
    return update_num === 0 && delete_num === 0 ? false : true;
});
const datasets_bind_length = computed(() => {
    return binds.value.filter((f) => f.datasets_id && !f.update).length;
});
const skill_bind_length = computed(() => {
    return binds.value.filter((f) => f.skill_id && !f.update).length;
});
const save_finish = ref(true);
async function save() {
    const expert_id = route.params.expert_id;
    let delDatasetsList = binds.value.filter((f) => f.datasets_id && f.del).map((m) => m.datasets_id);
    let delSkillList = binds.value.filter((f) => f.skill_id && f.del).map((m) => m.skill_id);
    let addDatasetsList = binds.value.filter((f) => f.datasets_id && f.update).map((m) => m.datasets_id);
    let addSkillList = binds.value.filter((f) => f.skill_id && f.update).map((m) => m.skill_id);
    save_finish.value = false;
    let rs = await axios.put(
        "/expert/bind",
        JSON.stringify({ expert_id, addDatasetsList, addSkillList, delDatasetsList, delSkillList })
    );
    save_finish.value = true;

    // 儲存後 左邊選單的關聯列表要重新取得
    queryClient.invalidateQueries({ queryKey: ["bindList", expert_id] });
    if (rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: "操作成功", color: "success" });
    } else {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
    }
}

// 知識庫比重設定
const useDatasetPriority = ref(true);
const prioritySetting = ref([0, 0, 0, 0, 0]);
const remainingQuota = ref(100);
const outOfQuota = ref(false);
const disabledData = 0;

async function getExpertConfig() {
    const rs = await axios.get(`/expert/getPrioritySetting/${route.params.expert_id}`);
    if (rs && rs.data && rs.data.code === 0) {
        prioritySetting.value = rs.data.data?.map((e) => parseInt(e * 100));
        useDatasetPriority.value = prioritySetting.value ? true : false;
    } else {
        emitter.emit("openSnackbar", { message: "取得設定異常。", color: "danger" });
        prioritySetting.value = null;
    }
}
getExpertConfig();

watchEffect(() => {
    // 先檢查是否有超出範圍的設定值
    const invalidData = prioritySetting.value?.find((e) => e < 0 || e > 100);
    if (invalidData) {
        remainingQuota.value = "--";
        return;
    }

    // 計算剩餘配額
    const usedQuota = prioritySetting.value?.reduce((sum, value) => parseInt(sum) + parseInt(value), 0);
    if (usedQuota && usedQuota > 0) {
        remainingQuota.value = 100 - usedQuota > 0 ? 100 - usedQuota : 0;
    }
});

async function savePriority() {
    const dataset_priority_setting = prioritySetting.value.map((e) => {
        if (typeof e !== Number) {
            return parseInt(e) / 100;
        } else {
            return e / 100;
        }
    });

    const reqBody = { dataset_priority_setting, expert_id: route.params.expert_id };
    const rs = await axios.post("/expert/setDatasetsPriority", JSON.stringify(reqBody));
    if (rs && rs.data && rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: "更新成功", color: "success" });
        getExpertConfig();
    } else {
        emitter.emit("openSnackbar", { message: "更新失敗", color: "danger" });
    }
}

async function togglePrioritySetting() {
    const reqBody = { expert_id: route.params.expert_id, isEnable: useDatasetPriority.value };
    const rs = await axios.post("/expert/toggleDatasetsPriority", JSON.stringify(reqBody));
    if (rs && rs.data && rs.data.code === 0) {
        emitter.emit("openSnackbar", { message: rs.data.message, color: "success" });
        getExpertConfig();
    } else {
        emitter.emit("openSnackbar", { message: "停用失敗", color: "danger" });
    }
}

const confirm_com_edit_priority = ref(null);
function confirmEditOpen() {
    // 檢查是否有超出範圍的設定值
    let invalidData = false;
    prioritySetting.value.forEach((e) => {
        if (e < 0 || e > 100) {
            invalidData = true;
        }
    });
    if (invalidData) {
        return emitter.emit("openSnackbar", { message: "輸入值只能介於0-100之間", color: "warning" });
    }

    // 檢查總和是否超過配額
    outOfQuota.value = false;
    const usedQuota = prioritySetting.value.reduce((sum, value) => parseInt(sum) + parseInt(value), 0);
    if (usedQuota > 100) {
        outOfQuota.value = true;
        return;
    } else {
        confirm_com_edit_priority.value.open();
    }
}

const showTooltip = ref(false);

function checkOverflow(event) {
    const element = event.target;
    if (element.scrollWidth > element.clientWidth) {
        showTooltip.value = true;
    } else {
        showTooltip.value = false;
    }
}

function hideTooltip() {
    showTooltip.value = false;
}
</script>

<template>
    <div class="expert_bing h-100 d-flex flex-column">
        <div class="mb-3 d-flex justify-space-between w-100 align-center">
            <v-btn
                prepend-icon="mdi-content-save-outline"
                @click="save"
                class="bg-blue"
                :disabled="!hasUpdate"
                :loading="!save_finish"
                >儲存</v-btn
            >
            <v-btn prepend-icon="mdi mdi-sort-ascending" color="info"
                >知識庫比重設定
                <v-dialog activator="parent" max-width="600">
                    <template v-slot:default="{ isActive }">
                        <v-card>
                            <v-card-title>
                                <div class="d-flex justify-space-between align-center">
                                    <p>知識庫分配比重設定</p>
                                    <div class="d-flex ga-1 align-center">
                                        <v-switch
                                            v-model="useDatasetPriority"
                                            @update:modelValue="togglePrioritySetting()"
                                            color="primary"
                                            :label="useDatasetPriority ? '啟用' : '停用'"
                                            :value="true"
                                            hide-details
                                        ></v-switch>
                                        <span class="mdi mdi-help-circle text-grey">
                                            <v-tooltip activator="parent" location="start"
                                                >啟用時套用知識庫優先級設定；停用時僅使用相關度做篩選。</v-tooltip
                                            >
                                        </span>
                                    </div>
                                </div>
                            </v-card-title>

                            <v-divider></v-divider>

                            <v-card-subtitle>
                                <p class="mt-2 text-end">尚未分配 {{ remainingQuota }}%</p>
                            </v-card-subtitle>

                            <v-card-text>
                                <!-- 標題 -->
                                <v-row>
                                    <v-col cols="3">
                                        <p class="text-h6">優先級</p>
                                    </v-col>
                                    <v-col cols="6">
                                        <p class="text-h6">比重 (%)</p>
                                    </v-col>
                                </v-row>

                                <!-- 設定欄位 -->
                                <v-row
                                    v-for="(value, index) in 5"
                                    :key="'priority-setting-' + value"
                                    class="align-center"
                                >
                                    <v-col cols="3">
                                        <p class="text-h6">Level {{ value }}</p>
                                    </v-col>
                                    <v-col cols="6">
                                        <v-text-field
                                            v-if="prioritySetting"
                                            v-model="prioritySetting[index]"
                                            suffix="%"
                                            type="number"
                                            hide-details
                                            max="100"
                                            min="0"
                                        ></v-text-field>
                                        <v-text-field
                                            v-else
                                            v-model="disabledData"
                                            suffix="%"
                                            type="number"
                                            hide-details
                                            max="100"
                                            min="0"
                                            :disabled="!prioritySetting"
                                        ></v-text-field>
                                    </v-col>
                                </v-row>
                            </v-card-text>

                            <v-divider></v-divider>

                            <v-card-actions>
                                <div class="ml-auto d-flex ga-3 align-center">
                                    <p v-if="outOfQuota" class="text-red-accent-4">設定值總和最多100%</p>
                                    <v-btn
                                        color="info"
                                        variant="tonal"
                                        @click="confirmEditOpen()"
                                        :disabled="!prioritySetting"
                                        >儲存</v-btn
                                    >
                                    <v-btn color="blue-grey-darken-1" variant="tonal" @click="isActive.value = false"
                                        >關閉</v-btn
                                    >
                                </div>
                            </v-card-actions>
                        </v-card>
                    </template>
                </v-dialog>
            </v-btn>
            <div class="d-flex">
                <div class="mr-4 d-flex align-center">
                    <span class="mark3-dashed"></span>
                    <span class="ml-1 text-overline">新增綁定</span>
                </div>
                <div class="mr-4 d-flex align-center">
                    <span class="mark4-solid mark4"></span>
                    <span class="ml-1 text-overline">刪除綁定</span>
                </div>
                <div class="mr-4 d-flex align-center">
                    <span class="mark mark1"></span>
                    <span class="ml-1 text-overline">知識庫</span>
                </div>
                <div class="d-flex align-center">
                    <span class="mark mark2"></span>
                    <span class="ml-1 text-overline">技能</span>
                </div>
            </div>
        </div>
        <div class="d-flex align-center w-100 h-100">
            <div
                class="overflow-hidden bg-white rounded-lg w-50 h-100 border-gray d-flex flex-column"
                @drop="handleDrop"
                @dragleave="handleDragleave"
                @dragover="handleDragover"
                ref="bind_dom"
            >
                <div class="px-2 py-1 text-white mark3 d-flex justify-space-between align-center font-weight-bold">
                    <div class="text-h6 font-weight-bold binding-text" @mouseenter="checkOverflow" @mouseleave="hideTooltip">
                        綁定 {{ data.name }}
                        <v-tooltip :disabled="!showTooltip" activator="parent" location="top" max-width="900px">
                            {{ data.name }}
                        </v-tooltip>
                    </div>
                    <div class="d-flex">
                        <v-chip class="ml-2 mark1" variant="flat">知識庫:{{ datasets_bind_length }}</v-chip>
                        <v-chip class="ml-2 mark2" variant="flat">技能:{{ skill_bind_length }}</v-chip>
                    </div>
                </div>
                <div class="overflow-auto pa-2">
                    <div v-for="(item, index) in binds" :key="index" class="d-flex align-center">
                        <div
                            :id="item.datasets_id || item.skill_id"
                            class="my-2 rounded w-100 pa-2 hover-move d-flex justify-space-between align-center"
                            :class="[
                                { 'border-datasets': item.datasets_id },
                                { 'border-skill': item.skill_id },
                                { 'border-datasets-dashed': item.datasets_id && item.update },
                                { 'border-skill-dashed': item.skill_id && item.update },
                                { 'del-line': item.del },
                                { 'hover-move': !item.disabled },
                                { 'disabled-item': item.disabled },
                            ]"
                            :draggable="!item.disabled"
                            @dragstart="!item.disabled && handleDragstart($event, item)"
                        >
                            <div class="d-flex align-center">
                                <p
                                    class="justify-center mr-2 rounded d-flex align-center color1"
                                    style="width: 1.2rem; height: 1.2rem"
                                    v-if="item.datasets_id"
                                >
                                    <i :class="item.icon || datasetsIcon"></i>
                                </p>
                                <p
                                    class="justify-center mr-2 rounded d-flex align-center color2"
                                    style="width: 1.2rem; height: 1.2rem"
                                    v-if="item.skill_id"
                                >
                                    <i :class="item.icon || skillsIcon"></i>
                                </p>
                                <p>{{ item.name }}</p>
                            </div>
                            <p v-if="item.datasets_id" style="color: #bdbdbd">
                                (優先級:{{ item.sort_priority === 0 ? "未設定" : item.sort_priority }})
                            </p>
                            <p v-if="item.skill_id" style="color: #bdbdbd">({{ item.class }})</p>
                        </div>
                        <!-- mdi-delete-outline -->
                        <!-- { mark4: item.del } -->
                        <v-icon
                            v-if="!item.update && !item.disabled"
                            :icon="item.del ? 'mdi-close' : 'mdi-delete'"
                            class="ml-2 rounded-circle mark4 btn-icon"
                            @click="delBind(item)"
                        ></v-icon>
                        <v-icon
                            v-else-if="!item.disabled"
                            icon="mdi-arrow-right"
                            class="ml-2 rounded-circle btn-icon"
                            :class="[
                                { mark1: item.datasets_id && item.update },
                                { mark2: item.skill_id && item.update },
                            ]"
                            @click="handleCancelBind(index)"
                        ></v-icon>
                    </div>
                </div>
            </div>
            <div class="w-50 h-100 d-flex flex-column">
                <div class="d-flex w-100 h-50 align-center">
                    <p class="mx-3 text-gray"><i class="fa-solid fa-arrow-right-arrow-left"></i></p>
                    <div class="overflow-hidden rounded-lg w-100 h-100 border-datasets d-flex flex-column">
                        <p class="px-2 py-1 text-h6 font-weight-bold mark1">知識庫</p>
                        <div class="overflow-auto pa-2">
                            <div v-for="(item, index) in datasets" :key="index" class="d-flex align-center">
                                <v-icon
                                    icon="mdi-arrow-left"
                                    @click="handleBind(item, index)"
                                    class="mr-2 mark1 rounded-circle"
                                    style="color: white; font-size: 1rem; min-width: 1.5rem; min-height: 1.5rem"
                                ></v-icon>
                                <div
                                    :id="item.datasets_id"
                                    style="transition: 0.3s"
                                    class="my-1 rounded w-100 border-datasets pa-2 hover-move d-flex justify-space-between"
                                    draggable="true"
                                    @dragstart="handleDragstart"
                                >
                                    <div class="d-flex align-center">
                                        <p
                                            class="justify-center mr-2 rounded d-flex align-center color1"
                                            style="width: 1.2rem; height: 1.2rem"
                                        >
                                            <i :class="item.icon || datasetsIcon"></i>
                                        </p>
                                        <p>{{ item.name }}</p>
                                    </div>
                                    <p style="color: #bdbdbd">
                                        (優先級:{{ item.sort_priority === 0 ? "未設定" : item.sort_priority }})
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="my-1"></div>
                <div class="d-flex w-100 h-50 align-center">
                    <p class="mx-3 text-gray"><i class="fa-solid fa-arrow-right-arrow-left"></i></p>
                    <div class="overflow-hidden rounded-lg w-100 h-100 border-skill d-flex flex-column">
                        <p class="px-2 py-1 text-h6 font-weight-bold mark2">技能</p>
                        <div class="overflow-auto pa-2">
                            <div v-for="(item, index) in skill" :key="index" class="d-flex align-center">
                                <v-icon
                                    icon="mdi-arrow-left"
                                    @click="handleBind(item, index)"
                                    class="mark2 rounded-circle"
                                    style="color: white; font-size: 1rem; min-width: 1.5rem; min-height: 1.5rem"
                                ></v-icon>
                                <div
                                    :id="item.skill_id"
                                    class="my-1 ml-2 rounded w-100 border-skill pa-2 hover-move d-flex justify-space-between"
                                    draggable="true"
                                    @dragstart="handleDragstart"
                                >
                                    <div class="d-flex align-center">
                                        <p
                                            class="justify-center mr-2 rounded d-flex align-center color2"
                                            style="width: 1.2rem; height: 1.2rem"
                                        >
                                            <i :class="item.icon || skillsIcon"></i>
                                        </p>
                                        <p>{{ item.name }}</p>
                                    </div>
                                    <p style="color: #bdbdbd">({{ item.class }})</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <ConfirmComponents
            ref="confirm_com_edit_priority"
            type="info"
            message="確定要儲存嗎 ?"
            :confirmBtn="true"
            @confirm="savePriority()"
            saveBtnName="確認"
            closeBtnName="取消"
        ></ConfirmComponents>
    </div>
</template>

<style lang="scss" scoped>
$color1: rgb(106, 174, 233);
$color2: rgb(104, 197, 127);
$color3: rgb(139, 139, 139);
$color4: rgb(240, 108, 108);
.mark {
    display: block;
    border-radius: 50%;
    width: 1rem;
    height: 1rem;
}
.color1 {
    color: $color1;
}
.color2 {
    color: $color2;
}
.mark1 {
    background-color: $color1;
    color: white;
}
.mark2 {
    background-color: $color2;
    color: white;
}
.mark3 {
    background-color: $color3;
    color: white;
}
.mark4 {
    background-color: $color4;
    color: white;
}
.mark4-solid {
    background-color: $color4;
    width: 1rem;
    height: 3px;
}
.mark3-dashed {
    border: 2px dashed $color3;
    width: 1rem;
    height: 10px;
    border-radius: 2px;
}
.border-datasets {
    border: 3px solid $color1;
}
.border-skill {
    border: 3px solid $color2;
}
.border-datasets-dashed {
    border: 3px dashed $color1;
}
.border-skill-dashed {
    border: 3px dashed $color2;
}
.btn-icon {
    font-size: 1rem;
    min-width: 1.5rem;
    min-height: 1.5rem;
}

.del-line {
    position: relative;
    &::after {
        content: "";
        position: absolute;
        width: 95%;
        height: 2px;
        top: 50%;
        left: 50%;
        transform: translateX(-50%);
        background-color: $color4;
    }
}

.hover-move {
    &:hover {
        cursor: move;
    }
}
.border-gray {
    border: 3px solid gray;
}
.text-gray {
    color: gray;
}
.dragstart {
    cursor: move;
}
.dragover {
    border: 3px dashed $color3;
}

.disabled-item {
    opacity: 0.5;
    cursor: not-allowed;
}
.binding-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
