<script setup>
import { ref, computed, watch, inject, onMounted, watchEffect } from "vue";
import { useDebounceFn } from "@vueuse/core";
import { useRoute } from "vue-router";
const route = useRoute();

import ScrollButton from "@/components/common/ScrollButton.vue";
import EmptyStateNoData from "@/components/common/EmptyStateNoData.vue";

import { getOutputText } from "@/utils/common";

const emitter = inject("emitter");
import axios from "@/global/axios";
import dayjs from "dayjs";

const searchContainer = ref(null);
const toggleSearchRow = ref(true);

// 搜尋時間
const startDate = ref("");
const startTime = ref("");
const endDate = ref("");
const endTime = ref("");

const users = ref([]); // 時間區間內有聊天紀錄的使用者(不包含遊客)
const selectedUsers = ref([]); // 被選擇的使用者
const dates = ref([]); // 時間區間內有聊天紀錄的日期
const chatDataTotal = ref([]); // 顯示的聊天紀錄
const totalChats = ref(0); // 時間區間內的總聊天數

const isSearching = ref(false);

const debouncedClick = useDebounceFn((searchType) => {
    filterSearch(searchType);
}, 200);

const debouncedKeyInput = useDebounceFn((searchType) => {
    filterSearch(searchType);
}, 500);

const filterSearch = async (searchType) => {
    // 檢查
    if (!startDate.value) {
        emitter.emit("openSnackbar", { message: "未填開始日期。", color: "error" });
        return;
    }
    if (!endDate.value) {
        emitter.emit("openSnackbar", { message: "未填結束日期。", color: "error" });
        return;
    }

    // 整理所需的user_ids
    let userIds = [];
    if (searchType !== "dateRange") {
        const userTypeIds = selectedUserTypes.value.map((e) => e.id);
        userIds = users.value.filter((e) => userTypeIds.includes(String(e.user_type_id))).map((e) => e.id);
        if (!userTypeIds.includes("2")) {
            const memberIds = selectedUsers.value.map((e) => e.id);
            userIds = userIds.concat(memberIds);
        }
    }

    // 重置
    if (searchType !== "date" && searchType !== "search" && searchType !== "changePage") {
        selectedDate.value = "All";
    }
    if (searchType !== "changePage") {
        pageNow.value = 1;
    }
    if (searchType === "dateRange") {
        selectAllUserTypes.value = true;
        selectedUserTypes.value = [...userTypes.value];
        users.value = [];
        selectAllUsers.value = true;
        selectedUsers.value = [];
        dates.value = [];
        selectAllChatType.value = true;
        selectedChatType.value = chatTypeList.value;
        pages.value = 1;
    }

    // 請求參數
    const body = {
        expertId: route.params.expert_id,
        startTime: `${startDate.value} ${startTime.value || "00:00"}:00`,
        endTime: `${endDate.value} ${endTime.value || "23:59"}:59`,
        date: selectedDate.value,
        chatType: selectedChatType.value.map((e) => e.type),
        userType: selectedUserTypes.value.map((e) => e.id),
        userIds: userIds,
        searchQuery: chatSearchQuery.value,
        page: pageNow.value,
        itemsPerPage: chatsPerPage.value,
    };

    // 取得聊天、使用者、日期資料
    isSearching.value = true;
    const response = await axios.post("/usermanage/getFiltedExpertChat", body);
    isSearching.value = false;

    // 設置資料
    chatDataTotal.value = response.data.data.chats_data.sort((a, b) => {
        return new Date(a.message_create_time) - new Date(b.message_create_time);
    });
    if (searchType !== "date" && searchType !== "search" && searchType !== "changePage") {
        dates.value = response.data.data.dates_data;
        totalChats.value = parseInt(response.data.data.total_chats);
    }

    if (searchType === "dateRange") {
        users.value = response.data.data.users_data;
        selectedUsers.value = response.data.data.users_data.filter((e) => e.user_type_id === 2);
    }

    pages.value = Math.ceil(parseInt(response.data.data.total_chats) / chatsPerPage.value) || 1;
    setTimeout(() => {
        scrollTopKey.value++;
    }, 100);
};

// 使用者類型
const userTypes = ref([
    {
        id: "1",
        name: "遊客",
    },
    {
        id: "2",
        name: "member",
    },
    {
        id: "3",
        name: "webapi",
    },
]);
const selectedUserTypes = ref([]);
const selectAllUserTypes = ref(true);

// 全選使用者類型
const changeAllUserTypes = () => {
    if (selectAllUserTypes.value) {
        selectedUserTypes.value = [...userTypes.value];
        selectedUsers.value = users.value.filter((e) => e.user_type_id === 2);
        selectAllUsers.value = true;
    } else {
        selectedUserTypes.value = [];
        selectedUsers.value = [];
        selectAllUsers.value = false;
    }

    debouncedClick("user");
};
// 選擇"單一"使用者類型
const checkUserTypes = (typeName) => {
    // 與使用者選項連動
    if (typeName === "member") {
        const isSelectAllUsers = selectedUserTypes.value.find((e) => e.name === "member");
        if (isSelectAllUsers) {
            selectedUsers.value = users.value.filter((e) => e.user_type_id === 2);
            selectAllUsers.value = true;
        } else {
            selectedUsers.value = [];
            selectAllUsers.value = false;
        }
    }

    // 檢查是否全選
    if (selectedUserTypes.value.length === userTypes.value.length) {
        selectAllUserTypes.value = true;
    } else {
        selectAllUserTypes.value = false;
    }

    debouncedClick("user");
};

// 選擇使用者相關功能
const selectAllUsers = ref(true);
const changeAll = () => {
    const hasMemberType = selectedUserTypes.value.find((e) => e.name === "member");
    const memberTypeData = userTypes.value.find((e) => e.name === "member");
    if (selectAllUsers.value) {
        selectedUsers.value = users.value.filter((e) => e.user_type_id === 2);

        if (!hasMemberType) {
            selectedUserTypes.value.push(memberTypeData);
        }
        if (selectedUserTypes.value.length === userTypes.value.length) {
            selectAllUserTypes.value = true;
        }
    } else {
        selectedUsers.value = [];
        selectAllUserTypes.value = false;
        if (hasMemberType) {
            selectedUserTypes.value = selectedUserTypes.value.filter((e) => e.name !== "member");
        }
    }
    debouncedClick("user");
};
const searchUser = ref(null);
const showUsers = computed(() => {
    let filteredUsers = users.value.filter((e) => e.user_type_id === 2);

    // 搜尋文字過濾
    if (searchUser.value) {
        filteredUsers = filteredUsers.filter((item) => item.name.includes(searchUser.value));
    }

    return filteredUsers;
});
const clickUserCheckbox = (user) => {
    const isSelectAll = selectedUsers.value.length === users.value.filter((e) => e.user_type_id === 2).length;

    if (isSelectAll) {
        selectAllUsers.value = true;
        const hasMemberType = selectedUserTypes.value.find((e) => e.name === "member");
        const memberTypeData = userTypes.value.find((e) => e.name === "member");
        if (!hasMemberType) {
            selectedUserTypes.value.push(memberTypeData);
        }
        if (selectedUserTypes.value.length === userTypes.value.length) {
            selectAllUserTypes.value = true;
        }
    } else {
        selectAllUsers.value = false;
        selectedUserTypes.value = selectedUserTypes.value.filter((e) => e.name !== "member");
        selectAllUserTypes.value = false;
    }
    debouncedClick("user");
};
const closeUserChip = (item) => {
    if (item.name === "全部") {
        selectAllUsers.value = false;
        changeAll();
    } else {
        const targetItemIndex = selectedUsers.value.findIndex((e) => e.id === item.id);
        if (targetItemIndex !== -1) {
            selectedUsers.value.splice(targetItemIndex, 1);
        }
    }
    debouncedClick("user");
};

const selectedDate = ref(null);

// 聊天型態分類
const chatTypeList = ref([
    {
        name: "錯誤",
        type: 0,
    },
    {
        name: "無相關答案",
        type: 9,
    },
    {
        name: "llm模型",
        type: 1,
    },
    {
        name: "技能",
        type: 2,
    },
    {
        name: "表單",
        type: 3,
    },
    {
        name: "快取",
        type: 4,
    },
]);
const selectedChatType = ref(chatTypeList.value);

const selectAllChatType = ref(true);
const checkAllChat = () => {
    if (selectAllChatType.value) {
        selectedChatType.value = chatTypeList.value;
    } else {
        selectedChatType.value = [];
    }
    debouncedClick("chat");
};
const checkChatType = () => {
    if (selectedChatType.value.length === chatTypeList.value.length) {
        selectAllChatType.value = true;
    } else {
        selectAllChatType.value = false;
    }
    debouncedClick("chat");
};

const selectChatDate = (date) => {
    selectedDate.value = date;
    pageNow.value = 1;
    debouncedClick("date");
};

// 分頁相關
const pages = ref(1);
const pageNow = ref(1);
const chatsPerPage = ref(10);

watch(
    () => chatsPerPage.value,
    () => {
        // 改變顯示數量時，將頁碼重設為1。
        pageNow.value = 1;
        debouncedClick("changePage");
    }
);

watch(pageNow, () => {
    debouncedClick("changePage");
});

// 搜尋聊天內容
const openFilterBox = ref(true);
const toggleFilterBox = () => {
    openFilterBox.value = !openFilterBox.value;
};

onMounted(() => {
    // 根據toggleSearchRow以及openFilterBox來調整功能列的高度
    watchEffect(() => {
        try {
            if (!searchContainer.value) return;

            let height = "0px";
            if (toggleSearchRow.value) {
                height = openFilterBox.value ? "300px" : "110px";
            }
            searchContainer.value.style.height = height;
        } catch (error) {
            console.log("error", error);
        }
    });
    selectedUserTypes.value = [...userTypes.value];
    endDate.value = dayjs().format("YYYY-MM-DD");
    endTime.value = "23:59";
});

const showSearchBar = ref(false);
const chatSearchQuery = ref("");
const toggleSearchBar = () => {
    showSearchBar.value = !showSearchBar.value;
    if (!showSearchBar.value) {
        chatSearchQuery.value = "";
    }
};

watch(chatSearchQuery, () => {
    debouncedKeyInput("search");
});

// 功能性function區
const highlightText = (text) => {
    if (!chatSearchQuery.value) return text;
    const regex = new RegExp(`(${chatSearchQuery.value})`, "gi");
    return text.replace(regex, '<mark class="highlight">$1</mark>');
};

const getDefaultDate = () => {
    // 預設開始日期為3個月前
    const currentDate = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(currentDate.getMonth() - 3);
    startDate.value = threeMonthsAgo.toISOString().split("T")[0];
};
getDefaultDate();

const setDateRange = (days) => {
    const currentDate = new Date();
    endDate.value = formatDate(currentDate);
    currentDate.setDate(currentDate.getDate() - days);
    startDate.value = formatDate(currentDate);
    startTime.value = "00:00";
    endTime.value = "23:59";
    debouncedClick("dateRange");
};

const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

// 訊息視窗DOM，用來傳遞給scroll按鈕元件用
const msgDOM = ref(null);

// 偵測顯示內容有變，要讓scroll回到頂端
const scrollTopKey = ref(0);
</script>

<template>
    <div class="d-flex flex-column" style="position: relative">
        <!-- 功能列 -->
        <div class="top-0 position-sticky" style="z-index: 1">
            <div class="d-flex ga-3" style="align-items: center; flex-wrap: wrap">
                <div class="flex-wrap d-flex ga-3 align-center" v-if="toggleSearchRow">
                    <p class="text-h6 text-no-wrap">快速查詢 :</p>
                    <v-btn class="date-btn" @click="setDateRange(0)" :disabled="isSearching">今日</v-btn>
                    <v-btn class="date-btn" @click="setDateRange(3)" :disabled="isSearching">最近3天</v-btn>
                    <v-btn class="date-btn" @click="setDateRange(7)" :disabled="isSearching">最近7天</v-btn>
                    <v-btn class="date-btn" @click="setDateRange(30)" :disabled="isSearching">最近30天</v-btn>
                </div>
                <!-- 選擇聊天日期 -->
                <div v-else class="top-date-picker">
                    <p>對話日期:</p>
                    <div class="chips-container">
                        <v-chip
                            v-if="totalChats > 0"
                            class="item"
                            :color="selectedDate === 'All' ? 'blue-lighten-2' : 'black'"
                            variant="outlined"
                            @click="selectChatDate('All')"
                            >{{ `全部(${totalChats})` }}</v-chip
                        >
                        <v-chip
                            v-else
                            class="item"
                            :color="selectedDate === 'All' ? 'blue-lighten-2' : 'black'"
                            variant="outlined"
                            >無</v-chip
                        >
                        <v-chip
                            v-for="item in dates"
                            :key="item.date"
                            class="item"
                            :color="selectedDate === item.date ? 'blue-lighten-2' : 'black'"
                            variant="outlined"
                            @click="selectChatDate(item.date)"
                            >{{ `${item.date} (${item.chatNumber})` }}</v-chip
                        >
                    </div>
                </div>
                <div style="width: 150px; margin-left: auto">
                    <v-select
                        v-model="chatsPerPage"
                        style="background-color: #eceff1"
                        hide-details
                        label="每頁顯示數量"
                        :items="[5, 10, 20, 50, 100]"
                    ></v-select>
                </div>
            </div>
            <div ref="searchContainer" class="search-container">
                <!-- 日期 -->
                <div class="flex-wrap mb-3 ga-3 d-flex align-center">
                    <div class="d-flex align-center">
                        <v-text-field
                            v-model="startDate"
                            type="date"
                            label="開始日期"
                            class="time-input"
                            hide-details
                        ></v-text-field>
                        <v-text-field
                            v-model="startTime"
                            class="time-input"
                            label="開始時間"
                            type="time"
                            clearable
                            hide-details
                        ></v-text-field>
                    </div>
                    <div class="d-flex" style="align-items: center">
                        <v-text-field
                            v-model="endDate"
                            type="date"
                            label="結束日期"
                            class="time-input"
                            hide-details
                        ></v-text-field>
                        <v-text-field
                            v-model="endTime"
                            class="time-input"
                            label="結束時間"
                            type="time"
                            clearable
                            hide-details
                        ></v-text-field>
                    </div>
                    <v-btn
                        prepend-icon="fa:fas fa-search"
                        color="info"
                        @click="debouncedClick('dateRange')"
                        :disabled="isSearching"
                    >
                        查詢
                    </v-btn>
                </div>
                <!-- 進階篩選 -->
                <div class="mb-3">
                    <div
                        class="filter-box-toggler"
                        @click="toggleFilterBox"
                        :style="{
                            left: openFilterBox ? '10px' : '0px',
                            top: openFilterBox ? '15px' : '0px',
                        }"
                    >
                        <p>進階篩選</p>
                        <span v-if="openFilterBox">
                            <i class="fa-solid fa-minus"></i>
                        </span>
                        <span v-else>
                            <i class="fa-solid fa-plus"></i>
                        </span>
                    </div>
                    <div class="filter-box" :class="openFilterBox ? 'showFilterBox' : 'hideFilterBox'">
                        <div v-show="openFilterBox">
                            <!-- 選擇使用者 -->
                            <div class="filter">
                                <p class="filter-title">使用者類型 :</p>
                                <div class="filter-items">
                                    <v-checkbox
                                        v-model="selectAllUserTypes"
                                        label="全選"
                                        @change="changeAllUserTypes"
                                        hide-details
                                        color="info"
                                        class="item"
                                    ></v-checkbox>
                                    <v-checkbox
                                        v-for="type in userTypes"
                                        :key="`userType-${type.id}`"
                                        v-model="selectedUserTypes"
                                        :label="type.name"
                                        :value="type"
                                        @change="checkUserTypes(type.name)"
                                        hide-details
                                        color="info"
                                        class="item"
                                        :indeterminate="
                                            type.name === 'member' &&
                                            selectedUsers.length > 0 &&
                                            selectedUsers.length !== users.filter((e) => e.user_type_id === 2).length
                                        "
                                    ></v-checkbox>
                                </div>
                            </div>
                            <div class="filter">
                                <p class="filter-title">已選使用者 :</p>
                                <div class="filter-items">
                                    <v-menu :close-on-content-click="false">
                                        <template v-slot:activator="{ props }">
                                            <v-btn
                                                :color="users.length > 0 ? 'blue-lighten-5' : 'grey-lighten-3'"
                                                v-bind="props"
                                            >
                                                選擇使用者 <i class="fa-solid fa-caret-down"></i
                                            ></v-btn>
                                        </template>
                                        <div
                                            style="
                                                background: white;
                                                min-width: 150px;
                                                box-shadow: 0px 2px 3px rgba(186, 186, 186, 0.5);
                                            "
                                        >
                                            <v-text-field
                                                v-if="users.length > 0"
                                                v-model="searchUser"
                                                label="搜尋使用者"
                                                append-inner-icon="mdi-magnify"
                                                clearable
                                                dense
                                                outlined
                                                hide-details
                                                class=""
                                            ></v-text-field>
                                            <v-list style="max-height: 200px; overflow-y: auto; padding: 0">
                                                <v-list-item
                                                    v-if="
                                                        users.filter((e) => e.user_type_id === 2).length > 0 &&
                                                        !searchUser
                                                    "
                                                >
                                                    <v-checkbox
                                                        v-model="selectAllUsers"
                                                        label="全選"
                                                        color="info"
                                                        hide-details
                                                        @change="changeAll"
                                                    ></v-checkbox>
                                                </v-list-item>
                                                <v-list-item
                                                    v-for="(user, index) in showUsers"
                                                    :key="index"
                                                    :value="index"
                                                >
                                                    <!-- todo: 不要這樣寫 要改掉 太多階層 -->
                                                    <v-checkbox
                                                        v-model="selectedUsers"
                                                        :label="user.name"
                                                        :value="user"
                                                        color="info"
                                                        hide-details
                                                        @change="clickUserCheckbox(user)"
                                                    ></v-checkbox>
                                                </v-list-item>
                                                <v-list-item v-if="showUsers.length === 0">
                                                    <p>無使用者可選</p>
                                                </v-list-item>
                                            </v-list>
                                        </div>
                                    </v-menu>

                                    <div
                                        v-if="selectedUsers.length !== users.filter((e) => e.user_type_id === 2).length"
                                    >
                                        <v-chip
                                            v-for="user in selectedUsers"
                                            color="secondary"
                                            variant="outlined"
                                            :key="user.id"
                                            class="item"
                                            closable
                                            @click:close="closeUserChip(user)"
                                        >
                                            <span>
                                                {{ user.name }}
                                            </span>
                                        </v-chip>
                                    </div>
                                    <v-chip
                                        v-if="
                                            users.filter((e) => e.user_type_id === 2).length !== 0 &&
                                            selectedUsers.length === users.filter((e) => e.user_type_id === 2).length
                                        "
                                        color="secondary"
                                        variant="outlined"
                                        class="item"
                                    >
                                        全選
                                    </v-chip>
                                    <v-chip
                                        v-if="selectedUsers.length === 0"
                                        color="secondary"
                                        variant="outlined"
                                        class="item"
                                    >
                                        無
                                    </v-chip>
                                </div>
                            </div>
                            <!-- 選擇聊天日期 -->
                            <div class="filter">
                                <p class="filter-title">對話日期 :</p>
                                <div class="filter-items">
                                    <v-chip
                                        v-if="dates.length > 0"
                                        class="item"
                                        :color="selectedDate === 'All' ? 'blue-lighten-2' : 'black'"
                                        variant="outlined"
                                        @click="selectChatDate('All')"
                                        >{{ `全部(${totalChats})` }}</v-chip
                                    >
                                    <v-chip
                                        v-else
                                        class="item"
                                        :color="selectedDate === 'All' ? 'blue-lighten-2' : 'black'"
                                        variant="outlined"
                                        >無</v-chip
                                    >
                                    <v-chip
                                        v-for="item in dates"
                                        :key="item.date"
                                        class="item"
                                        :color="selectedDate === item.date ? 'blue-lighten-2' : 'black'"
                                        variant="outlined"
                                        @click="selectChatDate(item.date)"
                                        >{{ `${item.date} (${item.chatNumber})` }}</v-chip
                                    >
                                </div>
                            </div>
                            <!-- 選擇對話type -->
                            <div class="filter">
                                <p class="filter-title">選擇對話型態 :</p>
                                <div class="filter-items">
                                    <v-checkbox
                                        v-model="selectAllChatType"
                                        label="全選"
                                        @change="checkAllChat"
                                        hide-details
                                        color="info"
                                        class="item"
                                    ></v-checkbox>
                                    <v-checkbox
                                        v-for="chatType in chatTypeList"
                                        :key="`chatType = ${chatType.name}`"
                                        v-model="selectedChatType"
                                        :label="chatType.name"
                                        :value="chatType"
                                        @change="checkChatType"
                                        hide-details
                                        color="info"
                                        class="item"
                                    ></v-checkbox>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- 收合按鈕 -->
            <v-btn class="search-row-toggle-btn" @click="toggleSearchRow = !toggleSearchRow">
                <div :class="toggleSearchRow ? 'rotate' : ''">
                    <i class="fa-solid fa-angles-down"></i>
                </div>
            </v-btn>
            <!-- 搜尋提問內容 -->
            <div class="search-bar-container">
                <v-btn icon @click="toggleSearchBar">
                    <v-icon>{{ showSearchBar ? "mdi-close" : "mdi-magnify" }}</v-icon>
                </v-btn>
                <v-slide-y-transition>
                    <v-text-field
                        v-if="showSearchBar"
                        v-model="chatSearchQuery"
                        label="搜尋提問內容"
                        append-inner-icon="mdi-magnify"
                        clearable
                        dense
                        outlined
                        hide-details
                        style="width: 300px; background-color: #ffffff"
                    ></v-text-field>
                </v-slide-y-transition>
            </div>
        </div>
        <!-- 訊息區塊 -->
        <v-progress-linear v-if="isSearching" color="blue-lighten-3" indeterminate></v-progress-linear>
        <div ref="msgDOM" class="relative px-3 pt-3 overflow-y-auto flex-1-1" style="border-top: 1px solid gray">
            <transition name="chat-item">
                <div v-if="chatDataTotal.length !== 0 && !isSearching">
                    <div v-for="chat in chatDataTotal" :key="chat.id" class="mb-7">
                        <div class="message user-message">
                            <!-- todo: 不要這樣寫 要改掉 太多階層 -->
                            <p style="font-size: 12px; margin-bottom: 6px">
                                {{ chat.user_type_id === 1 ? "遊客" : chat.name }}
                            </p>
                            <div class="justify-end align-end d-flex ga-1">
                                <div class="text-right message-time text-caption">
                                    {{ dayjs(chat.create_time).format("YYYY-MM-DD HH:mm:ss") }}
                                </div>
                                <div class="message-content" v-dompurify-html="highlightText(chat.input)"></div>
                            </div>
                        </div>
                        <div class="message bot-message">
                            <p style="font-size: 12px; margin-bottom: 6px">專家</p>
                            <div
                                class="message-content"
                                v-dompurify-html="highlightText(getOutputText(chat.output))"
                            ></div>
                        </div>
                        <v-divider :thickness="3"></v-divider>
                    </div>
                </div>
            </transition>
            <EmptyStateNoData
                v-if="chatDataTotal.length === 0"
                headline="查無對話數據"
                text="請調整搜尋條件，再試一次。"
            />

            <ScrollButton
                v-if="chatDataTotal.length > 0"
                :targetDOM="msgDOM"
                :position="{ right: '50px', bottom: '100px' }"
                :scrollTopKey="scrollTopKey"
            />
        </div>
        <!-- 分頁元件 -->
        <div class="pagination-container">
            <v-pagination v-model="pageNow" :length="pages" :total-visible="5" rounded="circle"></v-pagination>
        </div>
    </div>
</template>

<style scoped lang="scss">
.date-btn {
    background-color: rgba(191, 232, 248, 0.3);
}

.time-input {
    background-color: rgb(240, 240, 240);
    flex: none;
}

@media screen and (max-width: 1240px) {
    .time {
        display: none;
    }
}

.message {
    margin-bottom: 16px;
    position: relative;
}

.user-message {
    text-align: right;
}

.bot-message {
    text-align: left;
}

.message-content {
    display: inline-block;
    max-width: 80%;
    padding: 8px 12px;
    border-radius: 18px;
    word-wrap: break-word;
}

.user-message .message-content {
    background-color: #e3f2fd;
}

.bot-message .message-content {
    background-color: #f5f5f5;
}

.scrollButtonContainer {
    width: 100px;
    display: flex;
    position: absolute;
    right: 50px;
    bottom: 80px;
    .btn {
        transition: all 0.3s ease-in-out;
        opacity: 1;
        transform: translateY(50px);
    }
    .btn-show {
        opacity: 1;
        transform: translateY(0px);
    }
}

.date-chips-container {
    padding-bottom: 6px;
    flex: 1;
    display: flex;
    gap: 6px;
    flex-wrap: nowrap;
    overflow-x: auto;
    border-bottom: 2px solid rgba(128, 128, 128, 0.3);
    .date-chip {
        flex: none;
        border-radius: 5px;
    }
}

.filter-box {
    overflow: hidden;
    transition: all 0.5s ease;
    position: relative;
    background: #d1e5ff48;
    border-radius: 5px;
    .filter {
        margin-bottom: 9px;
        display: flex;
        align-items: center;
        .filter-title {
            width: 130px;
            text-align: right;
            padding-right: 10px;
        }
        .filter-items {
            padding-bottom: 3px;
            flex: 1;
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: nowrap;
            overflow-x: auto;
            border-bottom: 2px solid rgba(211, 211, 211, 0.3);
            .item {
                flex: none;
            }
        }
    }
}

.filter-items::-webkit-scrollbar-thumb {
    background-color: rgb(105, 153, 255);
    border-radius: 5px;
}

.filter-box-toggler {
    width: 110px;
    transition: all 0.5s ease;
    cursor: pointer;
    display: flex;
    gap: 9px;
    background: #ffffff;
    padding: 5px 10px;
    border-radius: 5px;
    box-shadow: 1px 1px 5px gray;
    position: relative;
    z-index: 1;
}

.showFilterBox {
    height: 100%;
    border: 3px dashed rgba(128, 128, 128, 0.466);
    padding: 15px 10px;
}

.hideFilterBox {
    height: 0px;
}

:deep(.v-checkbox .v-selection-control) {
    min-height: 0px;
}

.search-row-toggle-btn {
    height: 20px;
    background: #ffffff;
    border-radius: 0px 0px 5px 5px;
    border-top: 1px solid gray;
    position: absolute;
    right: 50%;
    bottom: -20px;
    transform: translate(50%, 0%);
}

.rotate {
    transform: rotate(180deg);
}

.search-bar-container {
    display: flex;
    align-items: center;
    gap: 10px;
    position: absolute;
    bottom: -70px;
    left: 10px;
}

.top-date-picker {
    width: calc(100% - 200px);
    display: flex;
    gap: 3px;
    align-items: center;
}

.top-date-picker p {
    text-wrap: nowrap;
    width: 80px;
}

.search-container {
    transition: all 0.5s ease;
    overflow-y: auto;
}

.top-date-picker .chips-container {
    overflow-x: auto;
    flex-wrap: nowrap;
    display: flex;
    gap: 2px;
    align-items: center;
    width: calc(100% - 80px);
    .item {
        flex: none;
    }
}

.chat-skeleton:nth-child(odd) {
    rotate: 180deg;
    margin-left: auto;
}

.chat-item-enter-active,
.chat-item-leave-active {
    transition: all 0.5s ease;
}

.chat-item-enter-from,
.chat-item-leave-to {
    opacity: 0;
}

.chat-item-enter-to,
.chat-item-leave-from {
    opacity: 1;
}

.pagination-container {
    position: absolute;
    bottom: 0;
    background-color: #ffffff;
    right: 0;
    left: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    border-top: 1px solid gray;
    z-index: 1;
}
</style>
