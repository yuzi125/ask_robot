import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { stopFetchStream } from "../global/fetchStream";

export const useUserStore = defineStore("userInfo", () => {
    // const avatar = ref("me.jpg");
    // const nickname = ref("鄧世雄");
    // const uid = ref("p001");
    const user_type = ref("guest");
    const avatar = ref("user-raw.png");
    const nickname = ref("遊客");
    const uid = ref("");
    const sex = ref(-1);
    const user_no = ref("");
    const contactList = ref([]);
    const tempUser = ref(null);

    return {
        user_type,
        uid,
        avatar,
        nickname,
        sex,
        user_no,
        contactList,
        tempUser,
    };
});

export const useSystemStore = defineStore("systemInfo", () => {
    // const systemAvatar = ref("https://i.imgur.com/OZYZQkF.png");
    // const systemAvatar = ref("robot.jpg");
    // const systemName = ref("Ava");
    const systemAvatar = ref("");
    const systemName = ref("");
    const restrictionTime = ref(null); // 被Ban時間
    const isIframe = window !== window.parent; // 檢查是否在iframe中
    const isMobile = window.innerWidth < 768; // 檢查是否在手機中
    const isKaohsiungEnv = import.meta.env.VITE_APP_MODE ? import.meta.env.VITE_APP_MODE.includes("kaohsiung") : false; // 檢查是否在高市府環境中

    // 這個標記是用來區分 iframe 載入方式，是直接用 html tag 載入，還是由 AVALoader 載入
    // static 代表是從 html tag 載入  <iframe src="http://localhost:5000/ava/avaClient/?from=static" class="ava-iframe"></iframe>
    const isStatic = window.location.search.includes("from=static");

    return {
        systemAvatar,
        systemName,
        restrictionTime,
        isIframe,
        isKaohsiungEnv,
        isMobile,
        isStatic,
    };
});

export const useStateStore = defineStore("state", () => {
    //聊天對像(預設機器人)
    // const chatPartner = ref({ partner: "bot", roomId: "bot", nickname: "Ava", avatar: "robot.jpg" });
    const chatPartner = ref({});
    // const chatPartner = ref({});
    //是否打開好友菜單
    const isOpenMenu = ref(true);
    //等待機器人回傳
    const isWaitRes = ref(false);
    //是否打開推薦詞列表
    const isOpenRecommend = ref(false);
    //歷史訊息
    const recommendList = ref([]);
    //處於哪個提示詞
    const recommendActive = ref(-1);
    //第幾筆歷史紀錄
    const recommendListActive = ref(-1);
    //是否打開指令列表
    const isOpenCmd = ref(false);
    //使用者輸入
    const userInput = ref("");
    //隧道模式是否開啟
    const is_tunnel = ref(false);
    //是否打開隧道模式選單列表
    const isOpenTunnelForm = ref(false);
    //使用者設定字體大小
    const chatFontSize = ref(16);
    const chatZoom = ref(100);
    //公告的高度
    const bulletinHeight = ref(0);
    //舊訊息數量
    const roomOldMessagesCount = ref(0);
    //資料庫連線狀態
    const db_error = ref(false);
    //是否已經檢查過資料庫了
    const db_first_check = ref(false);
    //是否顯示標籤
    const showTags = ref(true);
    // 等待指定專家房間建立
    const pendingTargetRoomId = ref("");
    //是否顯示標籤容器
    const showTagsContainer = ref(false);
    //是否顯示專家權限不足
    const showExpertAccessRestricted = ref(false);
    // history message id 給檔案上傳 loading 的時候用
    const historyMessageIdForFileTranslation = ref(0);
    //是否為翻譯專家
    const isTranslationExpert = ref(false);

    //換聊天對象
    function changePartner(item) {
        if (isWaitRes.value) {
            stopFetchStream();
        }
        isWaitRes.value = false;
        // isOpenMenu.value = false;
        if (item.identity == "bot") {
            chatPartner.value = {
                partner: "bot",
                expertId: item.expertId,
                roomId: item.roomId,
                nickname: item.nickname,
                avatar: item.avatar,
            };
        } else if (item.identity == "user") {
            chatPartner.value = {
                partner: "user",
                uid: item.uid,
                roomId: item.roomId,
                nickname: item.nickname,
                avatar: item.avatar,
                dep_no: item.dep_no,
            };
        }
    }

    return {
        chatPartner,
        isOpenMenu,
        isWaitRes,
        isOpenRecommend,
        recommendList,
        recommendActive,
        recommendListActive,
        isOpenCmd,
        userInput,
        is_tunnel,
        isOpenTunnelForm,
        chatFontSize,
        chatZoom,
        bulletinHeight,
        db_error,
        db_first_check,
        roomOldMessagesCount,
        showTags,
        showTagsContainer,
        pendingTargetRoomId,
        showExpertAccessRestricted,
        historyMessageIdForFileTranslation,
        changePartner,
        isTranslationExpert,
    };
});

export const useSettingsStore = defineStore("settings", () => {
    const system_version = ref("");
    const bulletin = ref({});
    const theme = ref({
        system_client_theme_default: "",
        themes: {}, // 存儲所有主題
        lockTheme: false,
    });
    const guest_enable = ref(false);
    const conversation_direction = ref("left");
    const welcome_word_update_frequency = ref(1);
    const show_extra_chunk = ref(true);
    const show_source_chunk = ref(true);
    const show_dataset_name = ref(true);
    const is_maintenance = ref("0");
    const enable_rtc_recording = ref(false);
    const max_message_length = ref(1000);
    const chat_input_height = ref(1);
    const chat_input_placeholder = ref("請輸入訊息");
    const agreement_alert = ref("請先同意使用說明才能使用此功能。");
    const current_environment = ref("");
    const chat_file_upload_enable = ref(false);
    const chat_file_translate_enable = ref(false);

    // 添加 getter 用於格式化主題選項
    const themeOptions = computed(() => {
        return Object.entries(theme.value.themes || {}).map(([name, themeData]) => ({
            value: name,
            label: themeData.remark ? `${themeData.remark}` : name,
        }));
    });

    return {
        system_version,
        bulletin,
        theme,
        guest_enable,
        conversation_direction,
        welcome_word_update_frequency,
        show_extra_chunk,
        show_source_chunk,
        show_dataset_name,
        is_maintenance,
        enable_rtc_recording,
        themeOptions, // 返回計算屬性
        max_message_length,
        chat_input_height,
        chat_input_placeholder,
        agreement_alert,
        current_environment,
        chat_file_upload_enable,
        chat_file_translate_enable,
    };
});

export const useApiStatusStore = defineStore("apiStatus", () => {
    const totalRequests = ref(0);
    const completedRequests = ref(0);
    const isForceComplete = ref(false); // 用於強制完成的判斷
    const allRequestsCompleted = computed(() => {
        // 如果完成的請求數 >= 8 或強制完成，則視為完成
        return completedRequests.value >= 8 || isForceComplete.value;
    });
    function registerRequest() {
        totalRequests.value++;
    }

    function markRequestComplete() {
        completedRequests.value++;
    }
    function forceComplete() {
        isForceComplete.value = true;
    }
    return {
        totalRequests,
        completedRequests,
        isForceComplete,
        allRequestsCompleted,
        registerRequest,
        markRequestComplete,
        forceComplete,
    };
});

export const useTermsStore = defineStore("terms", () => {
    // 核心狀態
    const termsAccepted = ref(false);
    const pendingMessage = ref(null);

    // 方法
    function setTermsAccepted(value) {
        termsAccepted.value = value;
    }

    function setPendingMessage(message) {
        pendingMessage.value = message;
    }

    function clearPendingMessage() {
        pendingMessage.value = null;
    }

    return {
        termsAccepted,
        pendingMessage,
        setTermsAccepted,
        setPendingMessage,
        clearPendingMessage,
    };
});
