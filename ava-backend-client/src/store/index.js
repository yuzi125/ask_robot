import { defineStore } from "pinia";
import { ref } from "vue";
import axios from "@/global/axios";

export const useUserStore = defineStore("userInfo", () => {
    const uid = ref("");
    const nickname = ref("");
    const email = ref("");
    const image = ref("");
    const user_no = ref("");
    const authSetting = ref(null);

    // 取得User的二次驗證設定
    async function getAuthSetting() {
        const rs = await axios.get("/user/getAuthSetting");
        if (rs && rs.data && rs.data.code === 0) {
            authSetting.value = rs.data.data || null;
        }
    }

    return {
        uid,
        nickname,
        email,
        image,
        user_no,
        authSetting,
        getAuthSetting,
    };
});

export const useStateStore = defineStore("state", () => {
    const datasetsName = ref("");
    const datasetsDescribe = ref("");
    const datasetsFolderName = ref("");
    const expertName = ref("");
    const datasetsIcon = ref("fa-solid fa-database");
    const skillsIcon = ref("fa-solid fa-screwdriver-wrench");
    const routeKey = ref(0);
    function updateForce() {
        routeKey.value++;
    }

    return {
        datasetsName,
        datasetsDescribe,
        datasetsFolderName,
        expertName,
        datasetsIcon,
        skillsIcon,
        routeKey,
        updateForce,
    };
});

export const usefileStore = defineStore("file", () => {
    const types = ref([
        "pdf",
        "docx",
        "doc",
        "txt",
        "csv",
        "xlsx",
        "pptx",
        "ppt",
        "jpg",
        "jpeg",
        "png",
        "gif",
        "bmp",
        "webp",
        "jfif",
    ]);

    const icons = ref([
        { type: "pdf", icon: "fa-solid fa-file-pdf", color: "#DD3633" },
        { type: "docx", icon: "fa-solid fa-file-word", color: "#2349A9" },
        { type: "doc", icon: "fa-solid fa-file-word", color: "#2349A9" },
        { type: "txt", icon: "fa-solid fa-file-lines", color: "#CACDD5" },
        { type: "csv", icon: "fa-solid fa-file-excel", color: "#169951" },
        { type: "xlsx", icon: "fa-solid fa-file-excel", color: "#169951" },
        { type: "pptx", icon: "fa-solid fa-file-powerpoint", color: "#D14424" },
        { type: "ppt", icon: "fa-solid fa-file-powerpoint", color: "#D14424" },
        { type: "jpg", icon: "fa-solid fa-file-image", color: "#2349A9" },
        { type: "jpeg", icon: "fa-solid fa-file-image", color: "#2349A9" },
        { type: "png", icon: "fa-solid fa-file-image", color: "#2349A9" },
        { type: "gif", icon: "fa-solid fa-file-image", color: "#2349A9" },
        { type: "bmp", icon: "fa-solid fa-file-image", color: "#2349A9" },
        { type: "webp", icon: "fa-solid fa-file-image", color: "#2349A9" },
        { type: "jfif", icon: "fa-solid fa-file-image", color: "#2349A9" },
    ]);

    return {
        types,
        icons,
    };
});

export const useSettingStore = defineStore("setting", () => {
    const maxFileSize = ref(0);
    const maxImageSize = ref(0);
    const sessionLimit = ref(0);
    const banIpExpireDate = ref(0);

    return {
        maxFileSize,
        maxImageSize,
        sessionLimit,
        banIpExpireDate,
    };
});

export const useFeedbackStore = defineStore("feedback", () => {
    const feedbackData = ref([]);
    const feedbackOptions = ref([]);

    return {
        feedbackData,
        feedbackOptions,
    };
});

export const useDefaultPromptStore = defineStore("default-prompt", () => {
    const defaultPrompts = ref([
        {
            id: "0",
            name: "不使用預設Prompt",
            describe: "",
            content: "",
            is_enable: 1,
            create_time: "2024-09-03T08:52:32.548Z",
            update_time: "2024-09-03T08:52:32.548Z",
        },
    ]);
    const gettingFinish = ref(false);

    async function getDefaultPrompts() {
        if (!gettingFinish.value) {
            try {
                const rs = await axios.get("/expert/defaultPrompt");
                defaultPrompts.value = defaultPrompts.value.concat(rs.data.data);
                gettingFinish.value = true;
            } catch (error) {
                console.error("取得default_prompt過程中發生錯誤。", rs);
                defaultPrompts.value = [];
            }
        }
    }
    return {
        defaultPrompts,
        getDefaultPrompts,
    };
});

export const useCacheStore = defineStore("cache", () => {
    const chunksData = ref([]);
    const loadingChunksData = ref(false);
    return {
        chunksData,
        loadingChunksData,
    };
});

export const usePermissionStore = defineStore("permission", () => {
    const userPermission = ref(false);
    const enableCrawler = ref(false);
    const pagePermissions = ref({});
    const expertPermissions = ref({});
    const datasetPermissions = ref({});
    const actionPermissions = ref({});

    function setPermissions(permissions) {
        userPermission.value = permissions.userPermission;
        pagePermissions.value = permissions.pagePermissions;
        expertPermissions.value = permissions.expertPermissions;
        datasetPermissions.value = permissions.datasetPermissions;
        actionPermissions.value = permissions.actionPermissions;
        enableCrawler.value = permissions.enableCrawler;
    }

    return {
        userPermission,
        pagePermissions,
        expertPermissions,
        datasetPermissions,
        actionPermissions,
        enableCrawler,
        setPermissions,
    };
});

export const useExpertStore = defineStore("expert", () => {
    const expertList = ref([]);
    return {
        expertList,
    };
});
