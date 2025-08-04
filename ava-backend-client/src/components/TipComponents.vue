<script setup>
import { ref } from "vue";
import InputComponents from "./InputComponents.vue";

const props = defineProps({
    tipData: Object,
    loading: Boolean,
    isEditing: Boolean,
});

const emit = defineEmits(["update", "enterEditMode", "exitEditMode"]);

const showHelp = ref(false);

function onUpdate(item) {
    emit("update", item);
}

function enterEditMode() {
    emit("enterEditMode");
}

function exitEditMode() {
    emit("exitEditMode");
}

function formatDate(text) {
    if (typeof text !== "string") {
        return text;
    }

    const parts = text.split(/(\{[^}]+\})/g);

    return parts
        .map((part) => {
            return part.replace(/{([^}]+)}/g, (match, content) => {
                const firstSpaceIndex = content.indexOf(" ");
                if (
                    firstSpaceIndex === -1 &&
                    !/^(now\([.\-\/]?\)|nextweek\(([0-6]|[.\-\/]|[0-6][.\-\/])?\)|nextmonth\([.\-\/]?\))$/.test(content)
                ) {
                    return match;
                }
                const date = content.slice(0, firstSpaceIndex);
                const offsets = [content.slice(firstSpaceIndex + 1).replace(/\s/g, "")];
                let newDate;

                // 預設分隔符為 '-'
                const originalSeparator = date.includes("-")
                    ? "-"
                    : date.includes("/")
                    ? "/"
                    : date.includes(".")
                    ? "."
                    : "-";

                // 初始化日期
                if (date.startsWith("now")) {
                    newDate = new Date();
                } else if (date.startsWith("nextweek")) {
                    const weekDay = content.match(/nextweek\(([0-6])(?:[.\-\/])?\)/);
                    const nextWeekDate = new Date();
                    if (weekDay) {
                        const targetDay = parseInt(weekDay[1], 10) % 7;
                        const currentDay = nextWeekDate.getDay();
                        let daysToAdd =
                            targetDay > currentDay ? targetDay - currentDay + 7 : targetDay - currentDay + 7;
                        nextWeekDate.setDate(nextWeekDate.getDate() + daysToAdd);
                    } else {
                        nextWeekDate.setDate(nextWeekDate.getDate() + 7);
                    }
                    newDate = nextWeekDate;
                } else if (date.startsWith("nextmonth")) {
                    const currentDate = new Date();
                    const safeDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                    safeDate.setMonth(safeDate.getMonth() + 1);
                    const lastDayOfNextMonth = new Date(safeDate.getFullYear(), safeDate.getMonth() + 1, 0).getDate();
                    newDate = new Date(
                        safeDate.getFullYear(),
                        safeDate.getMonth(),
                        Math.min(currentDate.getDate(), lastDayOfNextMonth)
                    );
                } else {
                    const dateParts = date.split(originalSeparator);
                    newDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                }

                // 處理偏移量
                offsets.forEach((offset) => {
                    const subOffsets = offset.match(/([+-]\d+)([dmyDMY]?)/g) || [];
                    subOffsets.forEach((subOffset) => {
                        const match = subOffset.match(/([+-])(\d+)([dmyDMY]?)/);
                        if (match) {
                            const sign = match[1] === "+" ? 1 : -1;
                            const amount = parseInt(match[2], 10) * sign;
                            const unit = match[3] ? match[3].toLowerCase() : "d"; // 如果單位缺失，預設為天 (d)
                            if (unit === "d") {
                                newDate.setDate(newDate.getDate() + amount);
                            } else if (unit === "m") {
                                newDate.setMonth(newDate.getMonth() + amount);
                            } else if (unit === "y") {
                                newDate.setFullYear(newDate.getFullYear() + amount);
                            }
                        }
                    });
                });

                if (isNaN(newDate.getTime())) {
                    return match; // 如果日期無效，返回原始字串
                }

                // 格式化日期，保持原分隔符
                const year = newDate.getFullYear();
                const month = String(newDate.getMonth() + 1).padStart(2, "0");
                const day = String(newDate.getDate()).padStart(2, "0");
                return `${year}${originalSeparator}${month}${originalSeparator}${day}`;
            });
        })
        .join("");
}

function tipFormatDate(input) {
    try {
        // 判斷是否為物件格式
        const parsed = JSON.parse(input);

        if (Array.isArray(parsed)) {
            // 處理陣列
            return JSON.stringify(
                parsed.map((item) => {
                    if (typeof item === "string") {
                        return formatDate(item);
                    } else if (typeof item === "object" && item !== null) {
                        // 遞歸處理物件
                        const newObj = {};
                        for (const key in item) {
                            newObj[key] = formatDate(item[key]);
                        }
                        return newObj;
                    }
                    return item;
                })
            );
        } else if (typeof parsed === "object" && parsed !== null) {
            // 處理單一物件
            const newObj = {};
            for (const key in parsed) {
                newObj[key] = formatDate(parsed[key]);
            }
            return JSON.stringify(newObj);
        }
        return input;
    } catch (e) {
        // 非 JSON 格式，直接格式化
        return formatDate(input);
    }
}

function getLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0"); // 月份從 0 開始
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

const shortcut = ref([
    {
        buttonValue: "buttonValue",
        clickValue: '{"clickValue":"","buttonValue":""}',
    },
    {
        buttonValue: "今天",
        clickValue: "{now()}",
    },
    {
        buttonValue: "今天 (日期)",
        clickValue: `{${getLocalDate()} }`,
    },
    {
        buttonValue: "明天",
        clickValue: "{now() +1d}",
    },
    {
        buttonValue: "下週",
        clickValue: "{nextweek()}",
    },
    {
        buttonValue: "下個月",
        clickValue: "{nextmonth()}",
    },
]);

function addShortcut(shortcutItem) {
    if (!isValidJson(props.tipData.text)) {
        return;
    }
    if (shortcutItem.clickValue === "poplastone") {
        const currentData = JSON.parse(props.tipData.text);
        currentData.pop();
        props.tipData.text = JSON.stringify(currentData);
        return;
    }
    let newValue;
    try {
        newValue = JSON.parse(shortcutItem.clickValue);
    } catch (e) {
        newValue = shortcutItem.clickValue; // 如果無法解析，則直接使用原始值
    }
    props.tipData.text = JSON.stringify([...JSON.parse(props.tipData.text), newValue]);
}

function isValidJson(str) {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}

function toggleHelp() {
    showHelp.value = !showHelp.value;
}
</script>

<template>
    <div>
        <!-- 第一區塊 快捷新增 -->
        <div v-if="isEditing" class="mb-5 section-card">
            <div class="section-header">
                <span class="text-h6 font-weight-medium">快捷新增tip</span>
                <div class="tooltip-wrapper">
                    <span class="mdi mdi-help-circle text-grey"></span>
                    <v-tooltip activator="parent" location="right">快捷新增tip說明</v-tooltip>
                </div>
            </div>
            <div class="button-container">
                <button
                    v-for="shortcutItem in shortcut"
                    :key="shortcutItem.buttonValue"
                    @click="addShortcut(shortcutItem)"
                    class="shortcut-tip-btn"
                >
                    {{ shortcutItem.buttonValue }}
                </button>
                <button @click="addShortcut({ buttonValue: '刪除', clickValue: 'poplastone' })" class="remove-btn">
                    <span class="mdi mdi-trash-can"></span>
                </button>
            </div>
        </div>

        <!-- 第二區塊 tip -->
        <!-- 
            請輸入陣列格式 例如：["技能1","技能2"]，如輸入的元素為物件，
            則必須包含 "buttonValue" 或 "clickValue" 屬性，
            buttonValue 為按鈕要顯示的文字，clickValue 為按鈕點擊後會輸出的文字；
            支援 {日期 +時間運算} 格式，能自動輸出成標準日期。
            例如{now() +1d}代表當前日期加上1天後的日期。now()中可以放入- / .，
            三種符號其中一個來指定日期分隔符；nextweek(數字0-6)則能指定下星期幾，
            無代入數字則顯示其當天對應到下週的同天，在數字後方加入- / .，
            即可指定日期分隔符；nextmonth()則能指定當天對應到下個月相同的日期，
            大小月問題會自動是該月最後一天。
        -->
        <div class="section-card">
            <div class="section-header">
                <div class="title-container">
                    <span class="text-h6 font-weight-medium">tip</span>
                    <div class="tooltip-wrapper">
                        <span class="mdi mdi-help-circle text-grey"></span>
                        <v-tooltip activator="parent" location="right">範例: 提示使用者 GPT 會哪些技能。</v-tooltip>
                    </div>
                </div>
                <div class="header-actions">
                    <v-tooltip
                        v-model="showHelp"
                        class="tipHelp"
                        location="bottom"
                        max-width="500"
                        :open-on-hover="false"
                        content-class="selectable-tooltip"
                    >
                        <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon variant="text" size="small" class="help-btn" color="primary">
                                <v-icon>mdi-information</v-icon>
                            </v-btn>
                        </template>
                        <div class="help-tooltip">
                            <!-- 關閉按鈕靠最右邊 -->
                            <div class="help-close-btn-container">
                                <button class="help-close-btn" @click="toggleHelp">
                                    <v-icon>mdi-close</v-icon>
                                </button>
                            </div>
                            <div class="help-section">
                                <div class="section-title">
                                    <v-icon size="small" color="primary">mdi-code-brackets</v-icon>

                                    <h4>基本格式</h4>
                                </div>
                                <div class="section-content">
                                    <p>請輸入陣列格式，例如：</p>
                                    <code>['技能1','技能2']</code>
                                </div>
                            </div>
                            <div class="help-section">
                                <div class="section-title">
                                    <v-icon size="small" color="primary">mdi-code-braces</v-icon>
                                    <h4>物件格式</h4>
                                </div>
                                <div class="section-content">
                                    <p>如輸入的元素為物件，必須包含：</p>
                                    <ul>
                                        <li><strong>buttonValue</strong>：按鈕顯示文字</li>
                                        <li><strong>clickValue</strong>：按鈕點擊後的值</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="help-section">
                                <div class="section-title">
                                    <v-icon size="small" color="primary">mdi-calendar</v-icon>
                                    <h4>日期格式</h4>
                                </div>
                                <div class="section-content">
                                    <p>支援以下日期格式：</p>
                                    <ul>
                                        <li><code>{now()}</code>：當前日期</li>
                                        <li><code>{now() +1d}</code>：明天</li>
                                        <li><code>{nextweek()}</code>：下週同一天</li>
                                        <li><code>{nextmonth()}</code>：下個月同一天</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </v-tooltip>
                    <v-btn icon variant="text" size="small" class="toggle-btn" color="primary" @click="toggleHelp">
                        <v-icon>{{ showHelp ? "mdi-close" : "mdi-help" }}</v-icon>
                    </v-btn>
                </div>
            </div>
            <InputComponents
                :loading="loading"
                :data="tipData"
                @send="onUpdate"
                @enterEditMode="enterEditMode"
                @exitEditMode="exitEditMode"
                hint="請輸入陣列格式，例如：['技能1','技能2']"
                multiline
                :rows="5"
            />
        </div>

        <!-- 第三區塊 預覽畫面 -->
        <div v-if="isEditing" class="mt-5">
            <div class="section-card preview-section">
                <div class="section-header">
                    <span class="text-h6 font-weight-medium">tip 預覽畫面</span>
                    <div class="tooltip-wrapper">
                        <span class="mdi mdi-eye text-grey"></span>
                        <v-tooltip activator="parent" location="right">預覽畫面說明</v-tooltip>
                    </div>
                </div>
                <div v-if="tipData && tipData.text" class="preview-container">
                    <div
                        v-for="(item, index) in isValidJson(tipData.text) ? JSON.parse(tipData.text) : []"
                        :key="index"
                    >
                        <template v-if="typeof item === 'string'">
                            <button class="tip-btn">{{ tipFormatDate(item) }}</button>
                        </template>
                        <template v-else-if="typeof item === 'object' && item !== null">
                            <button class="tip-btn">{{ tipFormatDate(item.buttonValue) }}</button>
                        </template>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.section-card {
    padding: 1.25rem;
    width: 100%;
    min-width: 400px;
    max-width: 1000px;
    margin-bottom: 1.75rem;
    background-color: #ffffff;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    transition: all 0.3s ease;
    overflow: visible;
}

.section-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.25rem;
    color: #3a4173;
    font-weight: 500;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.section-header .text-h6 {
    margin-right: 8px;
}

.tooltip-wrapper {
    display: inline-flex;
    align-items: center;
    position: relative;
    margin-left: 8px;
}

.section-header .mdi-help-circle,
.section-header .mdi-eye {
    opacity: 0.7;
    transition: opacity 0.2s;
    font-size: 1.1rem;
    cursor: pointer;
}

.section-header .mdi-help-circle:hover,
.section-header .mdi-eye:hover {
    opacity: 1;
}

.button-container {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 1rem;
    background-color: #f4f7fc;
    border-radius: 8px;
    margin-bottom: 0.5rem;
}

.shortcut-tip-btn {
    padding: 0.7rem 1rem;
    border-radius: 8px;
    border: none;
    background: linear-gradient(to right, #6576db, #7a89e8);
    color: white;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(101, 118, 219, 0.2);
}

.shortcut-tip-btn:hover {
    box-shadow: 0 4px 8px rgba(101, 118, 219, 0.3);
    background: linear-gradient(to right, #5465c5, #6576db);
}

.remove-btn {
    padding: 0.7rem 1rem;
    border-radius: 8px;
    border: none;
    background: linear-gradient(to right, #e74c3c, #c0392b);
    color: white;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(231, 76, 60, 0.2);
}

.remove-btn:hover {
    box-shadow: 0 4px 8px rgba(231, 76, 60, 0.3);
    background: linear-gradient(to right, #c0392b, #e74c3c);
}

.preview-section {
    background-color: #f8fafc;
    border: 1px dashed #6576db;
}

.preview-container {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 1rem;
    border-radius: 8px;
    background-color: white;
}

.tip-btn {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: none;
    background: linear-gradient(to right, #6576db, #7a89e8);
    color: white;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
}

.tip-btn:hover {
    box-shadow: 0 2px 6px rgba(101, 118, 219, 0.3);
}

.help-btn {
    opacity: 0;
    transition: all 0.2s ease;
}

.tipHelp:deep(.v-overlay__content) {
    background: none;
    border: none;
    box-shadow: none;
    user-select: text;
    pointer-events: auto;
}

:deep(.selectable-tooltip) {
    pointer-events: auto !important;
    user-select: text !important;
}

.help-tooltip {
    background-color: white !important;
    padding: 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border: none;
    position: relative;
    z-index: 100;
    pointer-events: auto;
    user-select: text;
}

.help-section {
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.help-section:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
}

.help-close-btn-container {
    width: 100%;
    display: flex;
    justify-content: flex-end;
}

.help-close-btn {
    color: #3a4173;
}

.section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
}

.section-title h4 {
    margin: 0;
    color: #3a4173;
    font-size: 0.95rem;
    font-weight: 600;
}

.section-content {
    padding-left: 24px;
}

.section-content p {
    margin: 0 0 8px 0;
    font-size: 0.9rem;
    color: #666;
}

.section-content ul {
    margin: 0;
    padding-left: 16px;
    font-size: 0.9rem;
    color: #666;
}

.section-content li {
    margin-bottom: 6px;
    line-height: 1.4;
}

.section-content code {
    display: inline-block;
    padding: 4px 8px;
    background-color: #f5f5f5;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.85rem;
    color: #333;
    margin: 4px 0;
}

.section-content strong {
    color: #3a4173;
    font-weight: 600;
}

.toggle-btn {
    margin-left: 8px;
}

.title-container {
    display: flex;
    align-items: center;
}
</style>
