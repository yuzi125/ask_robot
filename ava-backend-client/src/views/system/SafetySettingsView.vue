<template>
    <div class="wrap">
        <SystemHeader title="安全設定" subtitle="系統安全設定" icon="mdi-shield-check" />
        <v-card class="card">
            <!-- 上方功能列 -->
            <v-card-title>
                <v-row>
                    <v-col cols="12" sm="6" md="4" lg="3" xl="2">
                        <v-text-field
                            v-model="searchData.ip"
                            label="搜尋 IP"
                            prepend-inner-icon="mdi-magnify"
                            density="compact"
                            variant="outlined"
                            hide-details
                        ></v-text-field>
                    </v-col>
                    <v-col cols="12" sm="6" md="4" lg="3" xl="2">
                        <v-text-field
                            v-model="searchData.operator"
                            label="搜尋操作人"
                            prepend-inner-icon="mdi-account-search"
                            density="compact"
                            variant="outlined"
                            hide-details
                        ></v-text-field>
                    </v-col>
                    <v-col cols="12" sm="12" md="4" lg="4" xl="4" class="flex-wrap justify-end ml-auto d-flex ga-3">
                        <v-btn color="primary" prepend-icon="mdi-plus" @click="addDialog = true"> 新增 IP </v-btn>
                        <v-btn color="secondary" prepend-icon="mdi-wrench-clock" @click="openRuleDialog">
                            禁用規則設定
                        </v-btn>
                    </v-col>
                    <v-col cols="12">
                        <p class="text-caption text-grey">雙擊【IP位置】、【封鎖至】欄位可以編輯該欄位。</p>
                    </v-col>
                </v-row>
            </v-card-title>

            <!-- IP 列表表格 -->
            <v-card-text class="card-text">
                <v-data-table
                    :headers="headers"
                    :items="filteredData"
                    class="data-table"
                    :no-data-text="'尚無IP限制設定'"
                    :loading-text="'載入中...'"
                    :items-per-page-text="'每頁顯示筆數'"
                    :page-text="'{0}-{1} 共 {2}筆'"
                >
                    <template v-slot:item.actions="{ item }">
                        <div class="d-flex align-center ga-1">
                            <v-btn
                                v-if="!editIPList.includes(item.id) && !editTimeList.includes(item.id)"
                                size="small"
                                variant="tonal"
                                color="primary"
                                @click="openDataEdition(item)"
                                >編輯</v-btn
                            >
                            <div v-else class="d-flex align-center ga-1">
                                <v-btn variant="tonal" size="small" color="primary" @click="saveBothData(item)"
                                    >儲存</v-btn
                                >
                                <v-btn variant="tonal" size="small" color="" @click="cancelEdition(item)"
                                    >取消編輯</v-btn
                                >
                            </div>
                            <v-btn variant="tonal" size="small" color="error" @click="confirmDelete(item)">刪除</v-btn>
                        </div>
                    </template>

                    <template v-slot:item.ip="{ item }">
                        <div class="d-flex align-center flex-nowrap" v-if="editIPList.includes(item.id)">
                            <v-text-field
                                min-width="150"
                                v-model="editedData.get(item.id).ip"
                                density="compact"
                                variant="outlined"
                                hide-details
                                class="mr-2 flex-grow-1"
                                @keyup.enter="saveNewIP(item, editedData.get(item.id).ip)"
                            ></v-text-field>
                            <!-- <v-btn
                                icon="mdi-check-bold"
                                variant="text"
                                color="primary"
                                @click="saveNewIP(item, editedData.get(item.id).ip)"
                            ></v-btn>
                            <v-btn
                                icon="mdi-close-thick"
                                variant="text"
                                color="error"
                                @click="cancelSingleEditBox(item, 'ip')"
                            ></v-btn> -->
                        </div>
                        <p v-else class="cursor-pointer hover-effect" @dblclick="openDataEdition(item, 'ip')">
                            {{ item.ip }}
                        </p>
                    </template>

                    <template v-slot:item.type="{ item }">
                        <v-chip
                            :color="item.type.includes('system') ? 'error' : 'warning'"
                            size="small"
                            class="font-weight-bold"
                        >
                            {{ item.type.includes("system") ? "系統Ban" : "手動Ban" }}
                        </v-chip>
                    </template>

                    <template v-slot:item.expired_time="{ item }">
                        <div class="d-flex align-center flex-nowrap" v-if="editTimeList.includes(item.id)">
                            <v-btn
                                :id="`menu-activator-${item.id}`"
                                append-icon="mdi-calendar-range"
                                variant="outlined"
                                width="200px"
                            >
                                {{
                                    editedData.get(item.id).isPermanent
                                        ? "永遠禁止"
                                        : getFullTime(editedData.get(item.id).expired_time)
                                }}
                            </v-btn>
                            <v-menu :activator="`#menu-activator-${item.id}`" :close-on-content-click="false">
                                <div class="time-menu">
                                    <v-checkbox
                                        label="永遠禁止"
                                        v-model="editedData.get(item.id).isPermanent"
                                        @change="handlePermanentChange(item, 'edit')"
                                        hide-details
                                    ></v-checkbox>

                                    <input
                                        type="date"
                                        :min="dayjs().format('YYYY-MM-DD')"
                                        v-model="editedData.get(item.id).expired_time.date"
                                        class="mb-3 input-date"
                                        @click="handleDateInputClick(item.id)"
                                        :class="{ 'disabled-input': editedData.get(item.id).isPermanent }"
                                    />
                                    <div class="d-flex align-center ga-2">
                                        <div class="input-time-container">
                                            <input
                                                type="number"
                                                min="0"
                                                max="23"
                                                v-model="editedData.get(item.id).expired_time.hour"
                                                :placeholder="
                                                    editedData.get(item.id).expired_time.backupHour !== null
                                                        ? editedData.get(item.id).expired_time.backupHour
                                                        : 0
                                                "
                                                :class="{
                                                    'input-time': true,
                                                    'input-error':
                                                        editedData.get(item.id).expired_time.hour > 23 ||
                                                        editedData.get(item.id).expired_time.hour < 0,
                                                    'disabled-input': editedData.get(item.id).isPermanent,
                                                }"
                                                @focus="editedData.get(item.id).expired_time.hour = null"
                                                @blur="
                                                    editedData.get(item.id).expired_time.hour =
                                                        editedData.get(item.id).expired_time.hour === null
                                                            ? editedData.get(item.id).expired_time.backupHour
                                                            : Math.min(
                                                                  Math.max(
                                                                      editedData.get(item.id).expired_time.hour,
                                                                      0
                                                                  ),
                                                                  23
                                                              )
                                                "
                                                @click="handleDateInputClick(item.id)"
                                            />
                                            <span
                                                class="input-suffix"
                                                :class="{
                                                    'text-error':
                                                        editedData.get(item.id).expired_time.hour > 23 ||
                                                        editedData.get(item.id).expired_time.hour < 0,
                                                    'disabled-label': editedData.get(item.id).isPermanent,
                                                }"
                                                >時</span
                                            >
                                        </div>
                                        <span>:</span>
                                        <div class="input-time-container">
                                            <input
                                                type="number"
                                                min="0"
                                                max="59"
                                                v-model="editedData.get(item.id).expired_time.minute"
                                                :placeholder="
                                                    editedData.get(item.id).expired_time.backupMinute !== null
                                                        ? editedData.get(item.id).expired_time.backupMinute
                                                        : 0
                                                "
                                                :class="{
                                                    'input-time': true,
                                                    'input-error':
                                                        editedData.get(item.id).expired_time.minute > 59 ||
                                                        editedData.get(item.id).expired_time.minute < 0,
                                                    'disabled-input': editedData.get(item.id).isPermanent,
                                                }"
                                                @focus="editedData.get(item.id).expired_time.minute = null"
                                                @blur="
                                                    editedData.get(item.id).expired_time.minute =
                                                        editedData.get(item.id).expired_time.minute === null
                                                            ? editedData.get(item.id).expired_time.backupMinute
                                                            : Math.min(
                                                                  Math.max(
                                                                      editedData.get(item.id).expired_time.minute,
                                                                      0
                                                                  ),
                                                                  59
                                                              )
                                                "
                                                @click="handleDateInputClick(item.id)"
                                            />
                                            <span
                                                class="input-suffix"
                                                :class="{
                                                    'text-error':
                                                        editedData.get(item.id).expired_time.minute > 59 ||
                                                        editedData.get(item.id).expired_time.minute < 0,
                                                    'disabled-label': editedData.get(item.id).isPermanent,
                                                }"
                                                >分</span
                                            >
                                        </div>
                                        <span>:</span>
                                        <div class="input-time-container">
                                            <input
                                                type="number"
                                                min="0"
                                                max="59"
                                                v-model="editedData.get(item.id).expired_time.second"
                                                :placeholder="
                                                    editedData.get(item.id).expired_time.backupSecond !== null
                                                        ? editedData.get(item.id).expired_time.backupSecond
                                                        : 0
                                                "
                                                :class="{
                                                    'input-time': true,
                                                    'input-error':
                                                        editedData.get(item.id).expired_time.second > 59 ||
                                                        editedData.get(item.id).expired_time.second < 0,
                                                    'disabled-input': editedData.get(item.id).isPermanent,
                                                }"
                                                @focus="editedData.get(item.id).expired_time.second = null"
                                                @blur="
                                                    editedData.get(item.id).expired_time.second =
                                                        editedData.get(item.id).expired_time.second === null
                                                            ? editedData.get(item.id).expired_time.backupSecond
                                                            : Math.min(
                                                                  Math.max(
                                                                      editedData.get(item.id).expired_time.second,
                                                                      0
                                                                  ),
                                                                  59
                                                              )
                                                "
                                                @click="handleDateInputClick(item.id)"
                                            />
                                            <span
                                                class="input-suffix"
                                                :class="{
                                                    'text-error':
                                                        editedData.get(item.id).expired_time.second > 59 ||
                                                        editedData.get(item.id).expired_time.second < 0,
                                                    'disabled-label': editedData.get(item.id).isPermanent,
                                                }"
                                                >秒</span
                                            >
                                        </div>
                                    </div>
                                </div>
                            </v-menu>

                            <!-- <v-btn
                                icon="mdi-check-bold"
                                variant="text"
                                color="primary"
                                @click="saveNewTime(item, editedData.get(item.id).expired_time)"
                            ></v-btn>
                            <v-btn
                                icon="mdi-close-thick"
                                variant="text"
                                color="error"
                                @click="cancelSingleEditBox(item, 'time')"
                            ></v-btn> -->
                        </div>
                        <div v-else class="cursor-pointer hover-effect" @dblclick="openDataEdition(item, 'time')">
                            <div class="text-no-wrap">
                                {{
                                    item.expired_time === null
                                        ? "永遠禁止"
                                        : dayjs(item.expired_time).format("YYYY-MM-DD HH:mm:ss")
                                }}
                            </div>
                        </div>
                    </template>

                    <template v-slot:item.operator="{ item }">
                        <v-chip class="text-no-wrap">{{ item.operator }}</v-chip>
                    </template>

                    <template v-slot:item.update_time="{ item }">
                        <div class="text-no-wrap">{{ dayjs(item.update_time).format("YYYY-MM-DD HH:mm:ss") }}</div>
                    </template>
                </v-data-table>
            </v-card-text>
        </v-card>

        <!-- 新增 IP Dialog -->
        <v-dialog v-model="addDialog" max-width="500px">
            <v-card>
                <v-card-title>
                    <span>新增 IP</span>
                </v-card-title>

                <v-card-text>
                    <v-container>
                        <v-row>
                            <v-col cols="12">
                                <v-text-field
                                    v-model="addBanedData.ip"
                                    variant="outlined"
                                    label="IP 位置"
                                    hide-details
                                    :rules="[ipv4Rule]"
                                    @keyup.enter="handleEnterKey"
                                ></v-text-field>
                            </v-col>
                            <v-col cols="12">
                                <div class="justify-center d-flex align-center">
                                    <v-divider class="mr-4"></v-divider>
                                    <p class="mb-0 text-no-wrap">封鎖期限</p>
                                    <v-divider class="ml-4"></v-divider>
                                </div>
                                <div class="d-flex flex-column ga-1 align-center justify-space-between">
                                    <v-checkbox
                                        v-model="addBanedData.isPermanent"
                                        class="text-no-wrap"
                                        label="永遠禁止"
                                        hide-details
                                        @change="handlePermanentChange(addBanedData, 'add')"
                                    ></v-checkbox>
                                    <span class="mb-4">or</span>
                                    <div class="justify-center d-flex ga-2 align-center">
                                        <span class="mr-2 text-no-wrap">期限</span>
                                        <input
                                            type="date"
                                            :min="dayjs().format('YYYY-MM-DD')"
                                            v-model="addBanedData.expired_time.date"
                                            @click="handleDateClick"
                                            :class="{ 'input-date': true, 'disabled-input': addBanedData.isPermanent }"
                                        />
                                        <div class="input-time-container">
                                            <input
                                                type="number"
                                                placeholder="0"
                                                min="0"
                                                max="23"
                                                v-model="addBanedData.expired_time.hour"
                                                :class="{
                                                    'input-time': true,
                                                    'input-error': isHourInvalid,
                                                    'disabled-input': addBanedData.isPermanent,
                                                }"
                                                @focus="addBanedData.expired_time.hour = null"
                                                @blur="
                                                    addBanedData.expired_time.hour =
                                                        addBanedData.expired_time.hour === null
                                                            ? 0
                                                            : Math.min(addBanedData.expired_time.hour, 23)
                                                "
                                                @click="handleDateClick"
                                            />
                                            <span
                                                class="input-suffix"
                                                :class="{
                                                    'text-error': isHourInvalid,
                                                    'disabled-label': addBanedData.isPermanent,
                                                }"
                                                >時</span
                                            >
                                        </div>
                                        <span>:</span>
                                        <div class="input-time-container">
                                            <input
                                                type="number"
                                                placeholder="0"
                                                min="0"
                                                max="59"
                                                v-model="addBanedData.expired_time.minute"
                                                :class="{
                                                    'input-time': true,
                                                    'input-error': isMinuteInvalid,
                                                    'disabled-input': addBanedData.isPermanent,
                                                }"
                                                @focus="addBanedData.expired_time.minute = null"
                                                @blur="
                                                    addBanedData.expired_time.minute =
                                                        addBanedData.expired_time.minute === null
                                                            ? 0
                                                            : Math.min(addBanedData.expired_time.minute, 59)
                                                "
                                                @click="handleDateClick"
                                            />
                                            <span
                                                class="input-suffix"
                                                :class="{
                                                    'text-error': isMinuteInvalid,
                                                    'disabled-label': addBanedData.isPermanent,
                                                }"
                                                >分</span
                                            >
                                        </div>
                                        <span>:</span>
                                        <div class="input-time-container">
                                            <input
                                                type="number"
                                                placeholder="0"
                                                min="0"
                                                max="59"
                                                v-model="addBanedData.expired_time.second"
                                                :class="{
                                                    'input-time': true,
                                                    'input-error': isSecondInvalid,
                                                    'disabled-input': addBanedData.isPermanent,
                                                }"
                                                @focus="addBanedData.expired_time.second = null"
                                                @blur="
                                                    addBanedData.expired_time.second =
                                                        addBanedData.expired_time.second === null
                                                            ? 0
                                                            : Math.min(addBanedData.expired_time.second, 59)
                                                "
                                                @click="handleDateClick"
                                            />
                                            <span
                                                class="input-suffix"
                                                :class="{
                                                    'text-error': isSecondInvalid,
                                                    'disabled-label': addBanedData.isPermanent,
                                                }"
                                                >秒</span
                                            >
                                        </div>
                                    </div>
                                </div>
                            </v-col>
                            <v-col cols="12"> </v-col>
                        </v-row>
                    </v-container>
                </v-card-text>

                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="grey darken-1" @click="closeAddDialog">關閉</v-btn>
                    <v-btn
                        color="primary"
                        variant="text"
                        @click="saveEdition(addBanedData, 'add')"
                        :disabled="!ipv4Rule(addBanedData.ip)"
                        >確定</v-btn
                    >
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 刪除 IP Dialog -->
        <v-dialog v-model="deleteDialog" max-width="400px">
            <v-card>
                <v-card-title>確認刪除</v-card-title>
                <v-card-text>
                    確定要刪除 <span class="IP-mark">IP: {{ deletedData.ip }} </span> 的禁止設定嗎？
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="error" variant="text" @click="deleteDialog = false">取消</v-btn>
                    <v-btn color="primary" variant="text" @click="deleteItem">確定</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 新增 session 次數設定的對話框 -->
        <v-dialog v-model="ruleDialog" max-width="600px">
            <v-card>
                <v-card-title>設定 Guest Cookie 次數</v-card-title>
                <v-card-text>
                    <v-text-field
                        v-model="sessionLimit"
                        label="每日創建 Guest Cookie 次數"
                        type="number"
                        min="1"
                        variant="outlined"
                        hide-details
                    ></v-text-field>
                </v-card-text>

                <div class="countdown-timer-container">
                    <v-card-title>暫停封鎖IP</v-card-title> 
                    <div style="margin-left: auto; margin-right: 2rem;">
                        <span>倒數計時：{{ formatCountdown(countdown) }}</span>
                    </div>
                </div>

                <div class="options-container">
                    <div class="custom-radio-group">
                        <p>快捷選擇：</p>
                        <div class="radio-options">
                            <label>
                                <input type="radio" value="1" v-model="pauseDuration" /> 一天
                            </label>
                            <label>
                                <input type="radio" value="7" v-model="pauseDuration" /> 七天
                            </label>
                            <label>
                                <input type="radio" value="30" v-model="pauseDuration" /> 一個月
                            </label>
                            <label>
                                <input type="radio" value="never" v-model="pauseDuration" /> 永久暫停
                            </label>
                            <label>
                                <input type="radio" value="stillBan" v-model="pauseDuration" /> 不動作
                            </label>                            
                        </div>
                    </div>

                    <div class="custom-date-group">
                        <p>自訂：</p>
                        <input
                            type="date"
                            v-model="customDate"
                            @focus="handleDateFocus"
                            :min="dayjs().add(1, 'day').format('YYYY-MM-DD')"
                            class="input-date"
                        />
                    </div>
                </div>

                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="grey darken-1" @click="closeRuleDialog">關閉</v-btn>
                    <v-btn color="primary" variant="text" @click="saveBanRuleSettings">儲存</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";

import { getBanIPList, addBannedIP, editBanIP, deleteBanIP, updateBanRuleSettings } from "@/network/service";
import emitter from "@/global/emitter";
import SystemHeader from "@/components/system/SystemHeader.vue";

import dayjs from "dayjs";

import { useUserStore, useSettingStore } from "@/store";
import { storeToRefs } from "pinia";
const userStore = useUserStore();
const { nickname, user_no } = storeToRefs(userStore);

const settingStore = useSettingStore();
const { sessionLimit, banIpExpireDate } = storeToRefs(settingStore);

// 表格欄位
const headers = [
    { title: "操作", key: "actions", align: "start", sortable: false, nowrap: true, fixed: true, width: "220px" },
    { title: "IP位置", key: "ip", align: "start", sortable: false, nowrap: true, width: "200px" },
    { title: "類型", key: "type", align: "start", sortable: false, nowrap: true },
    { title: "封鎖至", key: "expired_time", align: "start", sortable: true, nowrap: true, width: "250px" },
    { title: "操作者", key: "operator", align: "start", sortable: false, nowrap: true },
    { title: "變更時間", key: "update_time", align: "start", sortable: true, nowrap: true },
];

// 列表資料
const dataList = ref([]);

// 搜尋條件
const searchData = ref({
    ip: "",
    operator: "",
});

// 過濾後的列表
const filteredData = computed(() => {
    return dataList.value.filter((item) => {
        const matchIP = item.ip.match(searchData.value.ip.toLowerCase());
        const matchOperator = item.operator.toLowerCase().match(searchData.value.operator.toLowerCase());
        return matchIP && matchOperator;
    });
});

// 獲取列表
const initialize = async () => {
    const response = await getBanIPList();
    if (response && response.data && response.data.code === 0) {
        dataList.value = response.data.data.sort(
            (a, b) => dayjs(a.expired_time).valueOf() - dayjs(b.expired_time).valueOf()
        );
    } else {
        emitter.emit("openSnackbar", { message: "取得禁止IP列表失敗", color: "error" });
    }
};

// 新增禁止IP
const addDialog = ref(false);
const addBanedData = ref({
    ip: "",
    expired_time: {
        date: null,
        hour: null,
        minute: null,
        second: null,
    },
    isPermanent: true,
});

const isHourInvalid = computed(() => {
    const hour = addBanedData.value.expired_time.hour;
    return hour < 0 || hour > 23;
});

const isMinuteInvalid = computed(() => {
    const minute = addBanedData.value.expired_time.minute;
    return minute < 0 || minute > 59;
});

const isSecondInvalid = computed(() => {
    const second = addBanedData.value.expired_time.second;
    return second < 0 || second > 59;
});

// 關閉對話框
const closeAddDialog = () => {
    addDialog.value = false;
    addBanedData.value = {
        ip: "",
        expired_time: {
            date: null,
            hour: null,
            minute: null,
            second: null,
        },
        isPermanent: true,
    };
};

// 編輯資料暫存
const editIPList = ref([]);
const editTimeList = ref([]);
const editedData = ref(new Map());

// 打開編輯項目
const openDataEdition = (item, type) => {
    if (type === "ip") {
        editIPList.value.push(item.id);
    } else if (type === "time") {
        editTimeList.value.push(item.id);
    } else {
        editIPList.value.push(item.id);
        editTimeList.value.push(item.id);
    }
    editedData.value.set(item.id, { ...item });

    const targetItem = editedData.value.get(item.id);
    targetItem.isPermanent = targetItem.expired_time === null;
    // 如果expired_time不是permanent,則格式化日期
    if (targetItem.expired_time != null) {
        targetItem.expired_time = {
            fullTime: dayjs(targetItem.expired_time).format("YYYY-MM-DD HH:mm:ss"),
            date: dayjs(targetItem.expired_time).format("YYYY-MM-DD"),
            hour: dayjs(targetItem.expired_time).hour(),
            minute: dayjs(targetItem.expired_time).minute(),
            second: dayjs(targetItem.expired_time).second(),
        };
    } else {
        targetItem.expired_time = {
            fullTime: null,
            date: null,
            hour: null,
            minute: null,
            second: null,
        };
    }
    targetItem.expired_time.backupHour = targetItem.expired_time.hour;
    targetItem.expired_time.backupMinute = targetItem.expired_time.minute;
    targetItem.expired_time.backupSecond = targetItem.expired_time.second;
};

// 取得合併的時間格式
const getFullTime = (item) => {
    try {
        if (!item || item.date === null || item.hour === null || item.minute === null || item.second === null) {
            return null;
        }
        return dayjs(`${item.date} ${item.hour}:${item.minute}:${item.second}`).format("YYYY-MM-DD HH:mm:ss");
    } catch (error) {
        console.log(error);
        return "";
    }
};

// 儲存編輯
const saveEdition = async (item, type) => {
    const operator = `${nickname.value} ( ${user_no.value} )`;
    // 新增時間驗證
    if (type === "add" || type === "edit") {
        const currentTime = dayjs();
        const selectedTime = dayjs(
            `${item.expired_time.date} ${item.expired_time.hour}:${item.expired_time.minute}:${item.expired_time.second}`
        );

        if (selectedTime.isBefore(currentTime)) {
            emitter.emit("openSnackbar", { message: "選擇的時間必須在目前時間之後", color: "error" });
            return;
        }
    }
    if (type === "edit") {
        if (!ipv4Rule(item.ip)) {
            emitter.emit("openSnackbar", { message: "無效的 IP 位置", color: "error" });
            return;
        }
        if (
            item.expired_time !== null &&
            ((item.expired_time.hour !== undefined && !isValidTime(item.expired_time.hour, "hour")) ||
                (item.expired_time.minute !== undefined && !isValidTime(item.expired_time.minute, "minute")) ||
                (item.expired_time.second !== undefined && !isValidTime(item.expired_time.second, "second")))
        ) {
            emitter.emit("openSnackbar", { message: "時間格式錯誤", color: "error" });
            return;
        }

        const res = await editBanIP({
            id: item.id,
            ip: item.ip,
            device: item.device,
            type: item.type,
            expired_time: getFullTime(item.expired_time),
            operator,
        });

        if (res && res.data && res.data.code === 0) {
            emitter.emit("openSnackbar", { message: "編輯成功", color: "success" });
            cancelEdition(item);
            await initialize();
        } else if (res && res.data && res.data.code === 1 && res.data.data.isDuplicate) {
            return { failed: true };
        } else {
            emitter.emit("openSnackbar", { message: res.data.message, color: "error" });
        }
    } else {
        // add
        if (item.ip === "") {
            emitter.emit("openSnackbar", { message: "IP 位置不能為空", color: "error" });
            return;
        }
        if (isHourInvalid.value || isMinuteInvalid.value || isSecondInvalid.value) {
            emitter.emit("openSnackbar", { message: "時間格式錯誤", color: "error" });
            return;
        }
        const res = await addBannedIP({
            ip: item.ip,
            expired_time: getFullTime(item.expired_time),
            operator,
        });

        if (res && res.data && res.data.code === 0) {
            emitter.emit("openSnackbar", { message: "新增成功", color: "success" });
            await initialize();
            closeAddDialog();
        } else if (res && res.data && res.data.code === 1 && res.data.data.isDuplicate) {
            emitter.emit("openSnackbar", { message: "IP已存在於封鎖列表中", color: "error" });
            return;
        } else {
            emitter.emit("openSnackbar", { message: res.message, color: "error" });
        }
    }
};

const saveNewIP = async (item, newIP) => {
    if (!ipv4Rule(newIP)) {
        emitter.emit("openSnackbar", { message: "無效的 IP 位置", color: "error" });
        return;
    }
    const newItemData = {
        ...item,
        ip: newIP,
    };
    try {
        const result = await saveEdition(newItemData, "edit");
        if (result && result.failed) {
            emitter.emit("openSnackbar", { message: "IP已存在於封鎖列表中", color: "error" });
            return;
        }
    } catch (error) {
        console.error("儲存失敗:", error);
    }
    cancelSingleEditBox(item, "ip");
};

const handlePermanentChange = (item, type) => {
    if (type === "add") {
        if (item.isPermanent) {
            addBanedData.value.expired_time.date = null;
            addBanedData.value.expired_time.hour = null;
            addBanedData.value.expired_time.minute = null;
            addBanedData.value.expired_time.second = null;
        } else {
            addBanedData.value.expired_time.date = dayjs().format("YYYY-MM-DD");
            addBanedData.value.expired_time.hour = 0;
            addBanedData.value.expired_time.minute = 0;
            addBanedData.value.expired_time.second = 0;
        }
    } else if (type === "edit") {
        const target = editedData.value.get(item.id);
        if (target.isPermanent) {
            target.expired_time.fullTime = null;
            target.expired_time.date = null;
            target.expired_time.hour = null;
            target.expired_time.minute = null;
            target.expired_time.second = null;
        } else {
            const originalTime = dataList.value.find((e) => e.id === item.id).expired_time;
            if (originalTime) {
                target.expired_time.fullTime = dayjs(originalTime).format("YYYY-MM-DD HH:mm:ss");
                target.expired_time.date = dayjs(originalTime).format("YYYY-MM-DD");
                target.expired_time.hour = dayjs(originalTime).hour();
                target.expired_time.minute = dayjs(originalTime).minute();
                target.expired_time.second = dayjs(originalTime).second();
            } else {
                target.expired_time.fullTime = dayjs().format("YYYY-MM-DD 00:00:00");
                target.expired_time.date = dayjs().format("YYYY-MM-DD");
                target.expired_time.hour = 0;
                target.expired_time.minute = 0;
                target.expired_time.second = 0;
            }
        }
    }
};

const saveNewTime = (item, newTime) => {
    const newItemData = {
        ...item,
        expired_time: newTime,
    };
    cancelSingleEditBox(item, "time");
    saveEdition(newItemData, "edit");
};

const saveBothData = async (item) => {
    try {
        const result = await saveEdition(editedData.value.get(item.id), "edit");
        if (result && result.failed) {
            emitter.emit("openSnackbar", { message: "IP已存在於封鎖列表中", color: "error" });
            return;
        }
    } catch (error) {
        console.error("儲存失敗:", error);
    }
};

// 取消單一編輯
const cancelSingleEditBox = (item, type) => {
    const ipEditOpen = editIPList.value.includes(item.id);
    const timeEditOpen = editTimeList.value.includes(item.id);
    if (type === "ip") {
        editIPList.value = editIPList.value.filter((e) => e !== item.id);
        !timeEditOpen && editedData.value.delete(item.id);
    } else if (type === "time") {
        editTimeList.value = editTimeList.value.filter((e) => e !== item.id);
        !ipEditOpen && editedData.value.delete(item.id);
    }
};
// 取消編輯
const cancelEdition = (item) => {
    editIPList.value = editIPList.value.filter((e) => e !== item.id);
    editTimeList.value = editTimeList.value.filter((e) => e !== item.id);
    editedData.value.delete(item.id);
};

// 刪除
const deleteDialog = ref(false);
const deletedData = ref(null);
const confirmDelete = (item) => {
    deleteDialog.value = true;
    deletedData.value = item;
};
const deleteItem = async () => {
    try {
        const operator = `${nickname.value} ( ${user_no.value} )`;
        const res = await deleteBanIP({
            ip: deletedData.value.ip,
            device: deletedData.value.device,
            status: deletedData.value.status,
            type: deletedData.value.type,
            expired_time: deletedData.value.expired_time,
            operator,
        });
        if (res && res.data && res.data.code === 0) {
            emitter.emit("openSnackbar", { message: "刪除成功", color: "success" });
        } else {
            emitter.emit("openSnackbar", { message: "刪除失敗", color: "error" });
        }
        await initialize();
        deleteDialog.value = false;
    } catch (error) {
        console.error("刪除失敗:", error);
    }
};

const ipv4Rule = (ip) => {
    const ipv4Pattern =
        /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Pattern.test(ip);
};

const handleEnterKey = () => {
    if (ipv4Rule(addBanedData.value.ip)) {
        saveEdition(addBanedData.value, "add");
    } else {
        emitter.emit("openSnackbar", { message: "無效的 IP 位置", color: "error" });
    }
};

const handleDateClick = () => {
    if (addBanedData.value.isPermanent) {
        addBanedData.value.isPermanent = false;
        const now = dayjs().add(30, "minute");
        addBanedData.value.expired_time.date = now.format("YYYY-MM-DD");
        addBanedData.value.expired_time.hour = now.hour();
        addBanedData.value.expired_time.minute = now.minute();
        addBanedData.value.expired_time.second = now.second();
    }
};

const handleDateInputClick = (itemId) => {
    const target = editedData.value.get(itemId);
    if (target.isPermanent) {
        target.isPermanent = false;
        const originalTime = dataList.value.find((e) => e.id === itemId).expired_time;
        if (originalTime) {
            target.expired_time.fullTime = dayjs(originalTime).format("YYYY-MM-DD HH:mm:ss");
            target.expired_time.date = dayjs(originalTime).format("YYYY-MM-DD");
            target.expired_time.hour = dayjs(originalTime).hour();
            target.expired_time.minute = dayjs(originalTime).minute();
            target.expired_time.second = dayjs(originalTime).second();
        } else {
            const now = dayjs().add(30, "minute");
            target.expired_time.fullTime = now.format("YYYY-MM-DD HH:mm:ss");
            target.expired_time.date = now.format("YYYY-MM-DD");
            target.expired_time.hour = now.hour();
            target.expired_time.minute = now.minute();
            target.expired_time.second = now.second();
        }
    }
};

// 檢查時分秒是否符合時間區間
const isValidTime = (num, type) => {
    if (type === "hour") {
        return num >= 0 && num <= 23;
    } else {
        return num >= 0 && num <= 59;
    }
};

// 新增 session 次數設定的狀態
const ruleDialog = ref(false);

// 原始狀態
let originalBanIpExpireDate = ref(null);
let originalPauseDuration = ref(null);
let originalCustomDate = ref(null);

// 打開對話框時保存當前狀態
const openRuleDialog = () => {
    originalBanIpExpireDate.value = banIpExpireDate.value;
    originalPauseDuration.value = pauseDuration.value;
    originalCustomDate.value = customDate.value;
    ruleDialog.value = true;
};

// 關閉對話框並恢復原始狀態
const closeRuleDialog = () => {
    banIpExpireDate.value = originalBanIpExpireDate.value;
    pauseDuration.value = originalPauseDuration.value;
    customDate.value = originalCustomDate.value;
    ruleDialog.value = false;
};

// 儲存 session 次數設定
const saveBanRuleSettings = async () => {
    const res = await updateBanRuleSettings({
        session_limit: sessionLimit.value,
        ban_ip_expire_date: banIpExpireDate.value,
    });
    if (res && res.data && res.data.code === 0) {
        emitter.emit("openSnackbar", { message: "儲存成功", color: "success" });
        ruleDialog.value = false;
        if (pauseDuration.value != "never" && pauseDuration.value != "stillBan") {
            pauseDuration.value = null;
            customDate.value = null;
        }
    } else {
        emitter.emit("openSnackbar", { message: "儲存失敗", color: "error" });
    }
};

// radio 選項
const pauseDuration = ref(null);
// date picker 選項
const customDate = ref(null);
// countdown 計時器
const countdown = ref(null);

const handleDateFocus = () => {
    pauseDuration.value = 'custom';
    customDate.value = dayjs().add(1, 'day').format('YYYY-MM-DD'); // 設置為當天日期
};

// 監聽 radio(pauseDuration) 和 選擇日期(customDate) 的變化 來調整 banIpExpireDate
watch([pauseDuration, customDate], ([newPauseDuration, newCustomDate]) => {
    if (newPauseDuration === "custom") {
        banIpExpireDate.value = dayjs(newCustomDate).format("YYYY-MM-DD");
    } else {
        customDate.value = null;
        if (newPauseDuration === "never") {
            banIpExpireDate.value = -1;
        } else if (newPauseDuration === "stillBan") {
            banIpExpireDate.value = 0;
        } else if (newPauseDuration) {
            const days = parseInt(newPauseDuration, 10);
            const targetDate = dayjs().add(days, 'day').startOf('day');
            banIpExpireDate.value = targetDate.format("YYYY-MM-DD");
        }
    }
});
// 監聽 banIpExpireDate 來調整 countdown
watch(banIpExpireDate, (newBanDate) => {
    if (newBanDate && newBanDate == -1) {
        countdown.value = -1;
    } else if (newBanDate && newBanDate !== -1 && newBanDate !== 0) {
        countdown.value = dayjs(newBanDate).toDate();
    } else {
        countdown.value = 0;
    }
});

// 格式轉換顯示countdown
const formatCountdown = (targetDate) => {
    if (targetDate == -1) {
        return "永久暫停";
    } else if (!targetDate || targetDate == 0) {
        return "不動作";
    }    

    const target = dayjs(targetDate).toDate();

    if (isNaN(target.getTime())) {
        return "不動作";
    }

    const now = new Date();
    const diff = target - now;
    if (diff <= 0) {
        return "已過期";
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${days} 天 ${hours} 小時 ${minutes} 分 ${seconds} 秒`;
};

// 初始化
initialize();

let countdownInterval;
onMounted(() => {
    // 依banIpExpireDate給予radio和countdown預設值
    if (banIpExpireDate.value != -1 && banIpExpireDate.value != 0) {
        countdown.value = dayjs(banIpExpireDate.value).toDate();
    } else {
        countdown.value = banIpExpireDate.value;
        if (countdown.value == -1) {
            pauseDuration.value = "never";
        } else if (countdown.value == 0) {
            pauseDuration.value = "stillBan";
        }
    }

    // 計時器
    countdownInterval = setInterval(() => {
        if (countdown.value > 0) {
            countdown.value -= 1;
        }
    }, 1000);
});
onUnmounted(() => {
    clearInterval(countdownInterval);
});
</script>

<style lang="scss" scoped>
.wrap {
    padding: 2rem;

    width: 100%;
    height: 100%;
}

.card {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    height: calc(100% - 10px);
    overflow-y: auto !important;
    .card-text {
        flex: 1;
    }
}

:deep(.v-table > .v-table__wrapper > table > tbody > tr > td) {
    vertical-align: middle;
}

:deep(th.v-data-table__td.v-data-table-column--align-start.v-data-table__th) {
    vertical-align: middle;
}

.data-table {
    height: 100%;
}

.IP-mark {
    color: red;
    font-weight: 700;
}

.time-menu {
    background-color: white;
    padding: 1rem;
    box-shadow: 0px 1px 1px 1px rgba(0, 0, 0, 0.1);
    border-radius: 4px;
}

.input-date {
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
    color: rgba(0, 0, 0, 0.87);
    cursor: pointer;
}

.input-time-container {
    position: relative;
    .input-time {
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 14px;
        color: rgba(0, 0, 0, 0.87);
        width: 60px;
        cursor: pointer;
    }
    .input-suffix {
        background-color: white;
        font-size: 12px;
        position: absolute;
        left: 5px;
        top: 0;
        transform: translateY(-50%);
        padding: 0 4px;
    }
}

.hover-effect {
    transition: all 0.3s;
    &:hover {
        text-decoration: underline;
    }
}

.input-error {
    border-color: red !important;
}

.text-error {
    color: red;
    font-weight: 700;
}

.disabled-input {
    border-color: rgb(232, 232, 232) !important;
    color: rgb(232, 232, 232) !important;
}

.disabled-label {
    color: rgb(232, 232, 232) !important;
}

.font-weight-bold {
    font-weight: bold;
}

.countdown-timer-container {
    display: flex;
    align-items: center;
    margin-bottom: 0.3rem;
    padding: 0.6rem;
    padding-left:0;
    padding-bottom: 0.3rem;
}

.options-container {
    background-color: #f7f6f6;
    padding: 1rem;
    border-radius: 5px;
    margin-left: 1.5rem;
    margin-right: 1.5rem;
}

.custom-radio-group {
    display: flex;
    align-items: center;
    margin-left: 2rem;
    font-size: 16px;
}

.custom-date-group {
    display: flex;
    align-items: center;
    margin-top: 1rem;
    margin-left: 2rem;
    gap: 0.3rem;
}

.radio-options {
    display: flex;
    gap: 1.2rem;
    margin-left: 0.3rem;
}
</style>
