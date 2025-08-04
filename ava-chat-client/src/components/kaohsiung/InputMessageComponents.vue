<script setup>
import { storeToRefs } from "pinia";
import { inject, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useSettingsStore, useStateStore } from "@/store/index";
import { useQuery } from "@tanstack/vue-query";
import ConfirmComponents from "@/components/ConfirmComponents.vue";
import { inputMessageService } from "@/network/inputMessageService";
import { Teleport } from "vue";
import { useToast } from "@/components/ui/toast";

const { toast } = useToast();
const stateStore = useStateStore();
const settingsStore = useSettingsStore();
const {
    chatPartner,
    isWaitRes,
    isOpenRecommend,
    recommendList,
    recommendActive,
    recommendListActive,
    isOpenCmd,
    userInput,
    is_tunnel,
    isOpenTunnelForm,
    showTags,
    showTagsContainer,
    isOpenMenu,
} = storeToRefs(stateStore);

const { enable_rtc_recording, chat_input_height, chat_input_placeholder, current_environment } =
    storeToRefs(settingsStore);

// const props = defineProps({});
const axios = inject("axios");
const emitter = inject("emitter");
const stopFetchStream = inject("stopFetchStream");

const route = useRoute();

const isLoading = ref(false);
// const userInput = ref("");
const user_input = ref(null);
const send_msg = ref(null);

const has_input = ref(false);

// 這個是用於檢查目前的一個週期內是否有按下 Enter  預設: 200 ms
let is_press_enter = false;

async function handleAreaHeight() {
    await nextTick();
    // 根據後台設定input框最小高度
    if (user_input.value.style.minHeight !== `${chat_input_height.value * 16 + 16}px`) {
        user_input.value.style.minHeight = `${chat_input_height.value * 16 + 16}px`;
    }

    // 根據input內容高度自動調整input框高度
    user_input.value.style.height = "0px";
    user_input.value.style.height = `${user_input.value.scrollHeight}px`;

    // 若input框高度超過最大高度，則添加overflow-y-auto類別
    let max_height = parseFloat(window.getComputedStyle(user_input.value).maxHeight);
    let self_height = parseFloat(user_input.value.style.height);
    user_input.value.classList.toggle("overflow-y-auto", self_height > max_height);
}
// let recommendListActive = -1;
let originaActive;
onMounted(() => {
    //如果刪減字到換行，高度也是由大到小，所以要判斷當減少時直接少21高度，不然會慢慢縮
    handleAreaHeight();
    emitter.on("iframe_focusInput", () => {
        user_input.value.focus();
    });
    emitter.on("clearFileUploader", () => {
        // 清空檔案列表
        if (fileUploaderRef.value && fileUploaderRef.value.clearFiles) {
            fileUploaderRef.value.clearFiles();
        }

        // 重置相關狀態
        attachedFiles.value = [];
        hasAttachedFiles.value = false;

        // 關閉上傳視窗
        showFileUploader.value = false;

        console.log("檔案上傳狀態已重置");
    });
    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") {
            user_input.value.focus();
            console.log("網頁可見");
        }
    });
    document.querySelector(".user_input").addEventListener("input", function (event) {
        handleAreaHeight();
        //偵測注音打到一半還不算input的情況
        if (!userInput.value) {
            if (event.data && event.data !== null) {
                has_input.value = true;
            }
            if (event.data === undefined || event.data === null) {
                has_input.value = false;
            }
        }
    });
    user_input.value.addEventListener("keyup", function (event) {
        const u = navigator.userAgent;
        const isAndroid = u.indexOf("Android") > -1;
        const isIPhone = u.indexOf("iPhone") > -1;
        if (isAndroid || isIPhone) {
            return;
        }

        if (!is_tunnel.value) {
            handleKeyup(event);
        }
    });
    user_input.value.addEventListener("keydown", function (event) {
        const u = navigator.userAgent;
        const isAndroid = u.indexOf("Android") > -1;
        const isIPhone = u.indexOf("iPhone") > -1;
        if (isAndroid || isIPhone) {
            return;
        }

        if (!is_tunnel.value) {
            handleKeydown(event);
        } else {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!isWaitRes.value) {
                    send_msg.value.click();
                }
            }
        }
    });

    document.getElementById("upload_pic").addEventListener("change", async function (event) {
        if (event.target.files.length == 0) return;
        const file = event.target.files[0];
        const formData = new FormData();
        formData.append("file", file);

        let rs = await axios.post("/contact/picture", formData, { headers: { "Content-Type": "multipart/form-data" } });
        console.log(rs.data.data);
        emitter.emit("pushData", { data: rs.data.data, type: "image" });
        // emit("pushData", { data: rs.data.data, type: "image" });
    });
    emitter.on("pushInput", async (data) => {
        userInput.value = data;
        // await nextTick();
        // user_input.value.focus();
    });

    // 熱門標籤
    const hotTagsElement = document.querySelector(".hot-tags");
    if (hotTagsElement) {
        hotTagsElement.addEventListener("wheel", handleWheelEvent, { passive: true });
        hotTagsElement.addEventListener("touchstart", handleTouchStart, { passive: true });
        hotTagsElement.addEventListener("touchmove", handleTouchMove, { passive: true });
        hotTagsElement.addEventListener("touchend", handleTouchEnd);
        hotTagsElement.addEventListener("mousedown", handleMouseDown);
        hotTagsElement.addEventListener("mousemove", handleMouseMove);
        hotTagsElement.addEventListener("mouseup", handleMouseUp);
        hotTagsElement.addEventListener("mouseleave", handleMouseLeave);
    }

    const handleDocumentDragEnd = () => {
        isDraggingGlobally.value = false;
    };

    const handleDocumentDragEnter = (e) => {
        if (is_tunnel.value) {
            return;
        }
        if (e.dataTransfer.types.includes("Files")) {
            isDraggingGlobally.value = true;
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape" && isDraggingGlobally.value) {
            isDraggingGlobally.value = false;
        }
    };
    document.addEventListener("dragend", handleDocumentDragEnd);
    document.addEventListener("dragenter", handleDocumentDragEnter);
    document.addEventListener("keydown", handleKeyDown);
});

function handleKeyup(event) {
    if (!event.ctrlKey) {
        // recommendActive.value = originaActive;
        isOpenRecommend.value = false;
    }
}
function handleKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey && !is_press_enter) {
        event.preventDefault();
        is_press_enter = true;
        //打開選單時按下Enter不送出
        if (isOpenCmd.value) return;
        if (!isWaitRes.value) {
            send_msg.value.click();
        }
        setTimeout(() => {
            is_press_enter = false;
        }, 200);
        // pushData();
    }
    // if (event.ctrlKey) {
    //     // originaActive = recommendActive.value;
    //     isOpenRecommend.value = true;
    //     if (!userInput.value) {
    //         recommendListActive.value = recommendList.value.length;
    //         recommendList.value.forEach((item) => {
    //             delete item.hover;
    //         });
    //         // recommendActive.value = 0;
    //     }
    // }
    if (event.ctrlKey && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        if (event.key === "ArrowUp") {
            // if (recommendListActive === -1 && userInput.value) {
            //     recommendList.value.unshift({ text: userInput.value });
            // }

            if (recommendListActive.value > 0) {
                recommendListActive.value--;
                recommendList.value.forEach((item) => {
                    item.hover = false;
                });
                recommendList.value[recommendListActive.value].hover = true;
                userInput.value = recommendList.value[recommendListActive.value].text;
            }
            // userInput.value = recommendList.value[0].text;
        } else if (event.key === "ArrowDown") {
            if (recommendListActive.value < recommendList.value.length - 1) {
                recommendListActive.value++;
                recommendList.value.forEach((item) => {
                    item.hover = false;
                });
                recommendList.value[recommendListActive.value].hover = true;
                userInput.value = recommendList.value[recommendListActive.value].text;
            }
        }
    }
    if (event.ctrlKey && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
        if (event.key === "ArrowRight") {
            recommendActive.value++;
        } else if (event.key === "ArrowLeft") {
            recommendActive.value--;
        }
    }
}

//輸入框提示熱鍵
const input_placeholder = ref([chat_input_placeholder.value]);
const input_placeholder_active = ref(0);
const positive = ref(true);
const placeholder_interval_second = 7000;
const placeholder_interval_fn = () => {
    if (input_placeholder.value.length > 1) {
        if (positive.value) {
            input_placeholder_active.value++;
        } else {
            input_placeholder_active.value--;
        }
    }
};
let placeholder_interval = setInterval(placeholder_interval_fn, placeholder_interval_second);
onUnmounted(() => {
    clearInterval(placeholder_interval);
    document.removeEventListener("dragenter", handleDocumentDragEnter);
    document.removeEventListener("dragend", handleDocumentDragEnd);
    document.removeEventListener("keydown", handleKeyDown);
});

watch(chat_input_placeholder, (newV) => {
    input_placeholder.value = [newV];
});

watch(input_placeholder_active, (newV) => {
    if (input_placeholder.value.length > 1) {
        if (newV === input_placeholder.value.length - 1) {
            positive.value = false;
        } else if (newV === 0) {
            positive.value = true;
        }
    }
});

watch(userInput, (newValue, oldValue) => {
    handleAreaHeight();
});

watch(chatPartner, (newValue, oldValue) => {
    user_input.value.focus();
    // console.log("old=> " + JSON.stringify(oldValue));
    localStorage.setItem("input_" + oldValue.roomId, userInput.value || "");

    if (!userInput.value?.trim()) {
        localStorage.removeItem("input_" + oldValue.roomId);
    }
    userInput.value = localStorage.getItem("input_" + newValue.roomId);

    // 熱門標籤
    if (newValue && newValue.expertId) {
        getIconList();
    }
});

async function pushData() {
    if (!userInput.value?.trim()) {
        return;
    }

    const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 0 && /Mobile/i.test(navigator.userAgent));
    const isSmallScreen = window.innerWidth <= 1000;
    let toastStyle = {
        left: (!isMobile || !isSmallScreen) && !isOpenMenu.value ? "8.5rem" : "0",
        width: !isMobile || !isSmallScreen ? "100%" : "70%",
        maxWidth: !isMobile || !isSmallScreen ? "400px" : "260px",
    };

    // 敏感資訊 先套用在高雄市政府 如果之後其他環境有需要的話再補上 不要直接在分支上改
    if (
        (current_environment.value === "kcg" || current_environment.value === "ksg") &&
        containsSensitiveInfo(userInput.value)
    ) {
        toast({
            title: "提示",
            description: `請勿輸入電話、身分證字號、email 等敏感資訊`,
            variant: "bottomOnly",
            duration: 3000,
            style: {
                padding: "1rem",
                backgroundColor: "#FFD306",
                top: "-4.6rem",
                right: "0",
                margin: "0 auto",
                ...toastStyle,
            },
        });
        return;
    }

    if (
        !is_tunnel.value &&
        !/^\/[te]/.test(userInput.value) &&
        userInput.value.replace(/\r?\n/g, "").length < minMessageLengthValue.value
    ) {
        toast({
            title: "提示",
            description: `請多描述您的提問，讓我們更好地協助您取得相關資訊！`,
            variant: "bottomOnly",
            duration: 3000,
            style: {
                padding: "1rem",
                backgroundColor: "#FFD306",
                top: "-4.6rem",
                right: "0",
                margin: "0 auto",
                ...toastStyle,
            },
        });
        return;
    }

    // console.log(userInput.value.replace(/\n/g, "<br>"));
    emitter.emit("pushData", { data: userInput.value, type: "text" });
    // emit("pushData", { data: userInput.value, type: "text" });
    //新增歷史訊息
    addHistoryMsg(userInput.value);
    //清空input與暫存input
    userInput.value = "";
    localStorage.removeItem("input_" + chatPartner.value.roomId);
    handleAreaHeight();
}
async function addHistoryMsg(text) {
    if (chatPartner.value.partner !== "bot") return;
    if (recommendList.value[recommendList.value.length - 1]?.text === text) return;
    emitter.emit("pushHistory", { text: text });
    let rs = await axios.post(
        "/bot/historyMessage",
        JSON.stringify({ text: text, expert_id: chatPartner.value.expertId })
    );
    if (rs.data.code !== 0) {
        console.log(rs.data.message);
    }
}
async function stopStream() {
    isWaitRes.value = false;
    stopFetchStream();
    const formData = new FormData();
    formData.append("roomId", route.params.roomId);
    fetch("/ava/api/stop", { method: "post", body: formData }).then((response) => {});
}

const openAudio = ref(false);

function decibelAnalysis(stream) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const canvas = document.getElementById("oscilloscope");
    const canvasCtx = canvas.getContext("2d");
    // 圓形中心點
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    // 半徑
    var radius = 50;

    // 繪製圓形
    function drawCircle() {
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        canvasCtx.beginPath();
        canvasCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        canvasCtx.fillStyle = "white";
        canvasCtx.fill();
        canvasCtx.closePath();
    }

    //計數
    let count = 0;
    //頻率(幾秒平均一次)
    let frequency = 0.1;
    //頻率內總和
    let sum = 0;

    function draw() {
        analyser.getByteTimeDomainData(dataArray);
        count++;
        const amplitude = Math.max(...dataArray) / 128.0;
        sum += amplitude * 1.2;
        if (count == 60 * frequency) {
            sum /= count;
            count = 0;
            radius = sum * 50;
        }

        drawCircle();
        requestAnimationFrame(draw);
    }

    draw();
}
let recorder;
let recordStream;
async function record() {
    console.log("record");
    if (openAudio.value) {
        stopRecord();
        openAudio.value = false;
        return;
    }
    openAudio.value = true;
    navigator.mediaDevices
        .getUserMedia({ audio: true, video: false })
        .then(function (stream) {
            recordStream = stream;
            //分貝分析
            decibelAnalysis(stream);
            // Use the stream to initialize the recorder
            recorder = RecordRTC(stream, {
                type: "audio", // Specify the type as 'audio'
                mimeType: "audio/wav",
                numberOfChannels: 1,
                recorderType: RecordRTC.StereoAudioRecorder,
            });
            window.recorder = recorder;
            // Start recording
            recorder.startRecording();

            // Show the recording indicator
        })
        .catch(function (error) {
            openAudio.value = false;
            console.error("Error accessing microphone:", error);
        });
}

const abortController = new AbortController();

function stopRecord() {
    isLoading.value = true;
    // return;
    recorder.stopRecording(function () {
        // Get the recorded audio as a Blob
        let recordedBlob = recorder.getBlob();
        recorder.reset();
        recorder.destroy();
        recordStream.getTracks().forEach((track) => track.stop());
        upload_audio_file(recordedBlob);
    });
}

// setTimeout(() => {
//     openAudio.value = false;
//     isLoading.value = false;
// }, 10000);
async function upload_audio_file(recordedBlob) {
    const formData = new FormData();
    formData.append("audio", recordedBlob, "recorded_audio.wav");
    formData.append("expert_id", chatPartner.value.expertId);

    try {
        const response = await fetch("/ava/chat/bot/avaUploadAudioFile", {
            // 更新為新的Node.js endpoint
            signal: abortController.signal,
            headers: { "x-code": "infochamp-s22" },
            method: "POST",
            mode: "cors",
            body: formData,
        });

        openAudio.value = false;
        isLoading.value = false;

        if (response.ok) {
            const text = await response.text();
            console.log("Response text:", text);

            userInput.value = text;
            handleAreaHeight();
            user_input.value.focus();
        } else {
            console.error("Error uploading file");
        }
    } catch (error) {
        console.error("Error uploading file:", error);
        nextTick(() => {
            // openAudio.value = false;
            // isLoading.value = false;
        });
    }
}

function stopFetch() {
    abortController.abort();
}

function switchRecommend() {
    isOpenRecommend.value = isOpenRecommend.value ? false : true;
}
// function switchFormMenu() {
//     isOpenTunnelForm.value = isOpenTunnelForm.value ? false : true;
// }
watch(is_tunnel, (newV) => {
    isOpenCmd.value = false;
    isOpenRecommend.value = false;
    // isOpenTunnelForm.value = false;
});

const cancel_confirm = ref(null);
function cancelform() {
    emitter.emit("pushData", { data: "/e", type: "text" });
    cancel_confirm.value.isOpen = false;
}

// 熱門標籤
const hotTags = ref([]);
const originalHotTags = ref([]);
const initialShowTagsContainer = ref(false);

const getIconList = async () => {
    try {
        const response = await axios.get("/bot/getIconList", {
            params: {
                expertId: chatPartner.value.expertId,
            },
        });

        if (response.data.code === 0) {
            let icons = response.data.data;
            const seenNames = new Set();
            const uniqueIcons = icons.filter((icon) => {
                if (seenNames.has(icon.name)) {
                    return false;
                }
                seenNames.add(icon.name);
                return true;
            });
            icons = uniqueIcons;
            hotTags.value = icons;
            originalHotTags.value = [...icons];

            if (hotTags.value.length > 0) {
                showTagsContainer.value = true;
                initialShowTagsContainer.value = true;
            } else {
                showTagsContainer.value = false;
                initialShowTagsContainer.value = false;
            }
        }
    } catch (error) {
        console.error("取得熱門標籤失敗:", error);
    }
};

let lastClickedTagName = null;
function handleTagClick(tag) {
    const tagContent = tag?.content || tag?.name;
    if (!tagContent) return;

    if (lastClickedTagName === tag.name && userInput.value === tagContent) {
        userInput.value = "";
        lastClickedTagName = null;
    } else {
        userInput.value = tagContent;
        lastClickedTagName = tag.name;
    }
}
function preventBlur(event) {
    event.preventDefault();
    event.stopPropagation();
}
function toggleTags() {
    showTags.value = !showTags.value;
    // if (!showTags.value) {
    //     hotTags.value = [];
    // } else {
    //     hotTags.value = [...originalHotTags.value];
    // }
}
function handleUserInputFocus() {
    if (!isOpenRecommend.value && initialShowTagsContainer.value) {
        showTagsContainer.value = true;
    }
}
function handleUserInputBlur() {
    showTagsContainer.value = false;
}

watch(isOpenRecommend, (newValue) => {
    if (newValue) {
        showTagsContainer.value = false; // 當 isOpenRecommend 為 true 時，強制設置 showTagsContainer 為 false
    }
});

watch(showTagsContainer, (newValue) => {
    if (newValue) {
        nextTick(() => {
            const hotTagsElement = document.querySelector(".hot-tags");
            if (hotTagsElement) {
                hotTagsElement.addEventListener("wheel", handleWheelEvent, { passive: true });
                hotTagsElement.addEventListener("touchstart", handleTouchStart, { passive: true });
                hotTagsElement.addEventListener("touchmove", handleTouchMove, { passive: true });
                hotTagsElement.addEventListener("touchend", handleTouchEnd);
                hotTagsElement.addEventListener("mousedown", handleMouseDown);
                hotTagsElement.addEventListener("mousemove", handleMouseMove);
                hotTagsElement.addEventListener("mouseup", handleMouseUp);
                hotTagsElement.addEventListener("mouseleave", handleMouseLeave);
            }
        });
    }
});

let initialX;
let initialScrollLeft;
let isTouchMove = false;

function handleWheelEvent(event) {
    const hotTagsElement = event.currentTarget;
    hotTagsElement.scrollLeft += event.deltaY;
}
function handleTouchStart(event) {
    isTouchMove = false;
    const hotTagsElement = event.currentTarget;
    initialX = event.touches[0].pageX - hotTagsElement.offsetLeft;
    initialScrollLeft = hotTagsElement.scrollLeft;
}
function handleTouchMove(event) {
    isTouchMove = true;
    const hotTagsElement = event.currentTarget;
    const x = event.touches[0].pageX - hotTagsElement.offsetLeft;
    const walk = (x - initialX) * 2;
    hotTagsElement.scrollLeft = initialScrollLeft - walk;
}
function handleTouchEnd(event) {
    preventBlur(event);
    event.currentTarget.classList.remove("tag-active");

    if (!isTouchMove) {
        const tag = hotTags.value.find((t) => t.name === event.currentTarget.dataset.tag);
        handleTagClick(tag);
    }
}
function handleToggleTagsTouchEnd(event) {
    preventBlur(event);
    toggleTags();
    if (!isTouchMove) {
        const tag = hotTags.value.find((t) => t.name === event.currentTarget.dataset.tag);
        handleTagClick(tag);
    }
}
function handleMouseDown(event) {
    event.preventDefault();
    const hotTagsElement = event.currentTarget;
    initialX = event.pageX - hotTagsElement.offsetLeft;
    initialScrollLeft = hotTagsElement.scrollLeft;
    hotTagsElement.style.cursor = "grabbing";
}
function handleMouseMove(event) {
    if (event.buttons !== 1) return; // 確保只有在按下滑鼠左鍵時才觸發
    event.preventDefault();
    const hotTagsElement = event.currentTarget;
    const x = event.pageX - hotTagsElement.offsetLeft;
    const walk = (x - initialX) * 2;
    hotTagsElement.scrollLeft = initialScrollLeft - walk;
}
function handleMouseUp(event) {
    const hotTagsElement = event.currentTarget;
    hotTagsElement.style.cursor = "grab";
}
function handleMouseLeave(event) {
    const hotTagsElement = event.currentTarget;
    hotTagsElement.style.cursor = "grab";
}
function handleTagTouchStart(event) {
    event.currentTarget.classList.add("tag-active");
}

// 最小輸入限制
const minMessageLengthValue = ref(0);
const { data: minMessageLength } = useQuery({
    queryKey: ["minMessageLength"],
    queryFn: inputMessageService.getMinMessageLength,
});
watch(minMessageLength, (newV) => {
    minMessageLengthValue.value = newV;
});

// 檔案相關
const fileUploaderRef = ref(null);
const attachedFiles = ref([]);
const hasAttachedFiles = ref(false);

// 檔案變更處理
const handleFilesChanged = (files) => {
    attachedFiles.value = files;
    hasAttachedFiles.value = files.length > 0;
};

// 全局拖曳狀態
const isDraggingGlobally = ref(false);
const globalDragCounter = ref(0);

// 切換檔案上傳區域顯示
const showFileUploader = ref(false);

// 檔案上傳狀態
const uploading = ref(false);
const uploadProgress = ref(0);
const uploadedFiles = ref([]);

// 處理檔案上傳

const handleGlobalDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // 檢查是否有檔案被拖曳
    if (e.dataTransfer.types.includes("Files")) {
        globalDragCounter.value++;
    }
};

const handleGlobalDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();

    globalDragCounter.value--;

    // 當所有拖曳離開事件都觸發後，重置計數器
    if (globalDragCounter.value <= 0) {
        globalDragCounter.value = 0;
        isDraggingGlobally.value = false;
    }

    if (!e.relatedTarget || e.relatedTarget === document.body) {
        isDraggingGlobally.value = false;
    }
};

// 處理檔案上傳
const handleUploadFiles = async (files) => {
    if (!files || files.length === 0) return;

    try {
        uploading.value = true;

        // 創建一個檔案上傳管理物件
        const filesMap = new Map();
        files.forEach((fileObj) => {
            filesMap.set(fileObj.id, fileObj);
        });

        // 為每個檔案創建獨立的上傳任務
        const uploadPromises = files.map(async (fileObj) => {
            try {
                // 為每個檔案創建新的 FormData
                const formData = new FormData();
                formData.append("userId", uid.value);
                formData.append("conversationId", chatPartner.value.roomId);
                formData.append("files", fileObj.file);

                // 發送單獨的上傳請求
                const response = await defaultAxios.post("/ava/chat/upload-files", formData, {
                    onUploadProgress: (progressEvent) => {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);

                        // 更新檔案上傳進度
                        if (fileUploaderRef.value) {
                            fileUploaderRef.value.updateFileProgress(fileObj.id, percentCompleted);
                        }

                        // 更新檔案的上傳進度
                        const fileIndex = attachedFiles.value.findIndex((f) => f.id === fileObj.id);
                        if (fileIndex !== -1) {
                            attachedFiles.value[fileIndex].progress = percentCompleted;
                        }
                    },
                });

                if (response.data.success) {
                    // 更新檔案信息
                    const fileInfo = response.data.data[0];

                    return {
                        id: fileObj.id,
                        name: fileObj.name,
                        serverFileName: fileInfo.name,
                        path: fileInfo.path,
                        type: fileObj.type,
                        size: fileObj.size,
                        icon: fileObj.icon,
                        status: fileInfo.status,
                        original: fileObj,
                    };
                } else {
                    throw new Error(response.data.message || "上傳失敗");
                }
            } catch (error) {
                console.error(`檔案 ${fileObj.name} 上傳失敗:`, error);

                // 標記檔案上傳失敗
                if (fileUploaderRef.value) {
                    fileUploaderRef.value.updateFileProgress(fileObj.id, 0);
                }

                // 通知用戶
                toast({
                    title: "檔案上傳失敗",
                    description: `${fileObj.name}: ${error.message || "請稍後再試"}`,
                    variant: "destructive",
                });

                return null;
            }
        });

        // 等待所有上傳完成
        const results = await Promise.all(uploadPromises);

        // 過濾出成功的上傳結果
        const successfulUploads = results.filter((result) => result !== null);

        if (successfulUploads.length > 0) {
            // 存儲上傳成功的檔案信息
            uploadedFiles.value = successfulUploads;

            // 更新 UI 狀態
            hasAttachedFiles.value = true;

            // 通知用戶
            toast({
                title: "檔案上傳成功",
                description: `已成功上傳 ${successfulUploads.length} 個檔案`,
                variant: "success",
            });

            // 隱藏上傳區域
            // showFileUploader.value = false;
        }
    } catch (error) {
        console.error("檔案上傳過程出錯:", error);

        toast({
            title: "檔案上傳出錯",
            description: error.message || "請稍後再試",
            variant: "destructive",
        });
    } finally {
        uploading.value = false;
    }
};

// 移除已上傳的檔案
const removeUploadedFile = async (file) => {
    const correctFile = uploadedFiles.value.find((f) => f.id === file.id);

    try {
        // 呼叫刪除 API
        await defaultAxios.delete(`/ava/chat/files/${uid.value}/${chatPartner.value.roomId}`, {
            data: { filenames: [correctFile.serverFileName] },
        });

        // 從上傳列表中移除
        uploadedFiles.value = uploadedFiles.value.filter((f) => f.id !== file.id);

        // 如果沒有檔案了，更新狀態
        if (uploadedFiles.value.length === 0) {
            hasAttachedFiles.value = false;
        }

        toast({
            title: "檔案已刪除",
            variant: "success",
        });
    } catch (error) {
        console.error("刪除檔案失敗:", error);

        toast({
            title: "刪除檔案失敗",
            description: error.message || "請稍後再試",
            variant: "destructive",
        });
    }
};
// 清除已上傳的檔案
const clearUploadedFiles = async () => {
    if (uploadedFiles.value.length === 0) return;

    try {
        // 呼叫刪除 API

        await defaultAxios.delete(`/ava/chat/files/${uid.value}/${chatPartner.value.roomId}`);

        // 重置狀態
        uploadedFiles.value = [];
        hasAttachedFiles.value = false;

        // 通知用戶
        toast({
            title: "檔案已清除",
            variant: "success",
        });
    } catch (error) {
        console.error("清除檔案錯誤:", error);
        toast({
            title: "清除檔案失敗",
            description: error.message || "請稍後再試",
            variant: "destructive",
        });
    }
};

// 處理全局檔案放下事件
// 處理全局檔案放下事件
const handleGlobalDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (is_tunnel.value) {
        return;
    }

    // 重置拖曳狀態
    isDraggingGlobally.value = false;

    // 使用 dataTransfer.items 獲取檔案 (更可靠)
    if (e.dataTransfer.items) {
        const files = [];

        // 處理每個項目
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
            // 只處理檔案類型的項目
            if (e.dataTransfer.items[i].kind === "file") {
                const file = e.dataTransfer.items[i].getAsFile();
                if (file) {
                    files.push(file);
                    console.log(`處理檔案: ${file.name} (${file.type}), 大小: ${file.size} bytes`);
                }
            }
        }

        // 如果有有效檔案
        if (files.length > 0) {
            console.log(`總共處理 ${files.length} 個檔案`);

            // 顯示檔案上傳區域
            showFileUploader.value = true;

            // 使用 nextTick 確保 DOM 已更新
            await nextTick();

            // 確保 fileUploaderRef 已經可用
            if (fileUploaderRef.value && typeof fileUploaderRef.value.handleExternalFiles === "function") {
                fileUploaderRef.value.handleExternalFiles(files);
            } else {
                console.error("fileUploaderRef 不可用或未定義 handleExternalFiles 方法");
            }
        } else {
            console.warn("未發現有效檔案");
        }
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        // 回退方案：使用 dataTransfer.files
        const filesArray = Array.from(e.dataTransfer.files);
        console.log(`使用回退方案處理 ${filesArray.length} 個檔案`);

        showFileUploader.value = true;

        await nextTick();

        if (fileUploaderRef.value && typeof fileUploaderRef.value.handleExternalFiles === "function") {
            fileUploaderRef.value.handleExternalFiles(filesArray);
        }
    }
};

const toggleFileUploader = () => {
    // 如果在隧道模式，不允許切換檔案上傳介面
    if (is_tunnel.value) {
        return;
    }

    showFileUploader.value = !showFileUploader.value;

    // 如果打開了 FileUploader 且有已上傳檔案，則同步到 FileUploader
    if (showFileUploader.value && uploadedFiles.value.length > 0) {
        // 等待 DOM 更新完成
        nextTick(() => {
            if (fileUploaderRef.value) {
                fileUploaderRef.value.setFiles(uploadedFiles.value);
            }
        });
    }
};
// 將全形字符轉換為半形字符
function toHalfWidth(str) {
    return (
        str
            // 先轉全形標點、數字、英文字元 U+FF01(！)–U+FF5E(～)
            .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
            // 再把全形空白 U+3000 去掉或轉成普通空白
            .replace(/\u3000/g, "")
    );
}
// 是否包含 電話、身分證字號、email 等資訊
function containsSensitiveInfo(text) {
    // 1. 全形轉半形
    const half = toHalfWidth(text);
    // 2. 移除所有空白（包含半形空格、tab、換行）
    const normalizedText = half.replace(/\s+/g, "");

    const phoneRegex =
        /(?:09\d{2}-\d{3}-\d{3}|09\d{8}|(?:\+886|\(886\)|\(\+886\)|886)(?:9\d{2}-\d{3}-\d{3}|9\d{8})|\((?:0(?!9)\d{1,2})\)(?:-?\d){7,8}|0(?!9)\d{1,2}(?:-?\d){7,8}|(?:\+886|\(886\)|\(\+886\)|886)(?!9)\d{1,2}(?:-?\d){7,8})/;
    const idRegex = /[A-Z][12]\d{8}/i;
    const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

    return phoneRegex.test(normalizedText) || idRegex.test(normalizedText) || emailRegex.test(normalizedText);
}
</script>

<template>
    <div class="tags-container" :style="{ top: hotTags.length === 0 ? '-2.5rem' : '-2.7rem' }" v-if="showTagsContainer">
        <button @click="toggleTags" @mousedown="preventBlur" @touchend="handleToggleTagsTouchEnd" class="toggle-button">
            <i class="fa-solid fa-fire"></i>
        </button>
        <div class="hot-tags" :class="{ hidden: !showTags }">
            <span
                v-for="tag in hotTags"
                :key="tag.name"
                @click="handleTagClick(tag)"
                @touchstart="handleTagTouchStart"
                @touchend="handleTouchEnd"
                :data-tag="tag.name"
                class="tag"
            >
                <i :class="tag.icon"></i>
                <span :style="{ marginLeft: tag.icon == '' ? '0rem' : '0.4rem' }">{{ tag.name }}</span>
            </span>
        </div>
    </div>

    <!-- 檔案上傳器(可切換顯示) -->
    <div v-if="showFileUploader" class="px-4 mb-2">
        <FileUploader
            ref="fileUploaderRef"
            @filesChanged="handleFilesChanged"
            @uploadFiles="handleUploadFiles"
            @removeFile="removeUploadedFile"
            :uploading="uploading"
            :uploadProgress="uploadProgress"
            :uploadedFiles="uploadedFiles"
        />
    </div>

    <Teleport to="#global-teleport-target">
        <div
            v-if="isDraggingGlobally && !is_tunnel"
            class="global-drag-overlay animated"
            @dragenter="handleGlobalDrag"
            @dragover="handleGlobalDrag"
            @dragleave="handleGlobalDragLeave"
            @drop="handleGlobalDrop"
        >
            <button class="close-button" @click="isDraggingGlobally = false">
                <i class="fa-solid fa-times"></i>
            </button>

            <div class="drag-message">
                <div class="drop-zone">
                    <div class="animated-border"></div>
                    <div class="icon-wrapper">
                        <i class="fa-solid fa-file-arrow-down"></i>
                    </div>
                    <h3>拖放檔案</h3>
                    <p>放開檔案以上傳</p>
                </div>
            </div>
        </div>
    </Teleport>

    <!-- 顯示已上傳檔案提示 (需要保留) -->
    <div v-if="hasAttachedFiles && !showFileUploader" class="px-4 py-1 mb-1">
        <div class="flex justify-between items-center">
            <div class="flex items-center text-xs cursor-pointer text-primary" @click="toggleFileUploader">
                <i class="mr-1 fa-solid fa-paperclip"></i>
                已附加檔案到此訊息 ({{ uploadedFiles.length }}個)
            </div>
            <button @click="clearUploadedFiles" class="text-xs hover:text-destructive text-muted-foreground">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>
    </div>

    <form class="input_msg" @submit.prevent="pushData">
        <div class="btn_group">
            <div v-if="chatPartner.partner == 'bot'">
                <!-- <p 
                    v-if="!is_tunnel"
                    @click="switchRecommend"
                    :class="{ isOpenRecommend: isOpenRecommend }"
                    class="text-[color:var(--chat-text-color)]"
                >
                    <i class="fa-solid fa-lightbulb"></i>
                </p> -->
                <!-- <p v-else @click="switchFormMenu" class="cmd_menu" :class="{ isOpenTunnelForm: isOpenTunnelForm }">
                    <i class="fa-solid fa-rectangle-list"></i>
                </p> -->
            </div>
            <label v-if="chatPartner.partner === 'user'" for="upload_pic"><i class="fa-solid fa-image"></i></label>
            <input type="file" id="upload_pic" style="display: none" />
        </div>
        <div class="input_box">
            <div class="left" v-if="!userInput && !has_input">
                <template v-if="!is_tunnel">
                    <div
                        v-for="(item, index) in input_placeholder"
                        :key="index"
                        class="placeholders"
                        :style="{
                            transform: `translateY(-${input_placeholder_active * 100}%)`,
                        }"
                    >
                        <p>{{ item }}</p>
                    </div>
                </template>
                <!-- <div v-else class="placeholders">
                    <p>申請模式中，按Ctrl顯示表單列表</p>
                </div> -->
            </div>
            <!-- placeholder="輸入 '/' 呼叫指令選單" -->
            <textarea
                type="text"
                class="user_input"
                v-model="userInput"
                id="ava-input"
                :disabled="openAudio"
                ref="user_input"
                :class="{ openAudioInput: openAudio, user_input_tunnel: is_tunnel }"
                @focus="handleUserInputFocus"
                @blur="handleUserInputBlur"
            ></textarea>
            <div class="relative bottom-4 z-50" v-if="enable_rtc_recording == 1">
                <span v-if="!openAudio" class="right" @click="record"><i class="fa-solid fa-microphone"></i></span>
                <span v-else class="right" @click="stopRecord" style="color: #3c45ff; font-size: 1.2rem">
                    <i class="fa-regular fa-circle-stop"></i>
                </span>
            </div>
            <div :class="{ 'margin-right-25': enable_rtc_recording == 1 }" class="right">
                <button v-if="is_tunnel" type="button" class="cancel_from" @click="cancel_confirm.isOpen = true">
                    取消申請
                </button>
            </div>
        </div>

        <button
            class="send_msg"
            ref="send_msg"
            type="submit"
            :disabled="openAudio || isWaitRes"
            :class="{
                'opacity-100 !bg-[#387F91]': userInput && !openAudio && !isWaitRes,
                '!cursor-not-allowed !bg-[#57B0B7]  opacity-50': !(userInput && !openAudio && !isWaitRes),
            }"
        >
            <p><i class="fa-solid fa-arrow-right"></i></p>
        </button>
        <!-- <button type="button" class="send_msg" @click="stopStream" v-else>
            <p><i class="fa-solid fa-stop"></i></p>
        </button> -->
    </form>
    <div
        class="relative w-full px-2 py-2 text-[color:var(--chat-text-color)] text-center text-xs text-token-text-secondary empty:hidden md:px-[60px]"
    >
        <div class="text-gray-500 min-h-4">
            <div>語言模型生成的答案提供參考，建議確認參考來源資料。</div>
        </div>
    </div>
    <div class="recording" @click="stopRecord" :class="{ recording_open: openAudio || isLoading }">
        <p class="stopPic"><i class="fa-regular fa-circle-stop"></i></p>
        <p>Tap to stop recording</p>
        <canvas id="oscilloscope" width="500" height="500"></canvas>
        <div class="loading" v-if="isLoading">
            <div class="icon">
                <img src="/loading.gif" alt="" />
            </div>
            <p>Converting to text...</p>
            <!-- <p class="close" @click="stopFetch"><i class="fa-solid fa-xmark"></i></p> -->
        </div>
    </div>
    <ConfirmComponents
        ref="cancel_confirm"
        title="確認要取消申請嗎?"
        detail="送出後將不可修改"
        @confirm="cancelform"
    ></ConfirmComponents>
</template>

<style lang="scss" scoped>
.margin-right-25 {
    margin-right: 25px;
}
.input_msg {
    width: 100%;
    z-index: 99999;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding-top: 0.3rem;
    background-color: var(--input-bg-color);
    position: relative;

    .btn_group {
        color: var(--text-color);
        font-size: 1.5rem;
        display: flex;
        padding: 0 1rem;
        // width: 7rem;
        transition: 0.3s;

        label {
            cursor: pointer;
        }

        p {
            cursor: pointer;
        }
        .cmd_menu {
            font-size: 1.3rem;
        }
        .isOpenTunnelForm,
        .isOpenRecommend {
            color: #facf55;
        }
    }

    .btn_zip_show {
        width: 3.5rem;
    }

    .btn_group_hidden {
        overflow: hidden;
        width: 0px;
    }

    .input_box {
        position: relative;
        display: flex;
        align-items: center;
        margin-right: 0.5rem;
        width: 100%;
        border-radius: 1.5rem;
        overflow: hidden;
        .left {
            user-select: none;
            cursor: text;
            position: absolute;
            left: 1rem;
            color: var(--text-color);
            font-size: 0.8rem;
            pointer-events: none;
            color: var(--text-color);
            opacity: 0.6;
            font-size: 0.9rem;
            display: flex;
            flex-direction: column;
            height: 3rem;

            .placeholders {
                line-height: 3rem;
                transition: 0.3s;
                // transform: translateY(-100%);
            }
        }

        .right {
            position: absolute;
            right: 0.5rem;
            color: var(--text-color);
            padding: 0.5rem;
            .cancel_from {
                border: none;
                background-color: var(--theme-color);
                color: white;
                border-radius: 0.2rem;
                cursor: pointer;
                padding: 0.2rem 0.5rem;
            }
        }

        .right_bottom {
            bottom: 0.5rem;
        }

        .user_input {
            background-color: var(--secondary-color);
            border-radius: 1.5rem;
            outline: none;
            border: none;
            padding-left: 1rem;
            padding-right: 2rem;
            padding-top: 0.5rem;
            padding-bottom: 0.5rem;
            width: 100%;
            color: var(--input-text-color);
            resize: none;
            font-size: 1rem;
            overflow: hidden;
            max-height: 50vh;

            // height: 0;
            // vertical-align: middle; /* 将文本内容垂直居中 */
            // line-height: 2.1rem;
            // height: 2.5rem;
            &:focus {
                border: 1px solid gray;
                background-color: var(--secondary-color);
            }
        }
        .user_input_tunnel {
            background-color: var(--theme-color-20);
            &:focus {
                border: 1px solid var(--theme-color);
                background-color: var(--theme-color-20);
            }
        }
        .overflow-y-auto {
            overflow-y: auto;
            overflow-x: hidden;
        }

        .openAudioInput {
            border: 1px solid #3c45ff;
        }
    }

    .disclaimer {
        font-size: 0.8rem;
        color: gray;
        position: absolute;
        bottom: 5px;
        right: 60px;
        left: 60px;
        text-align: center;
        // white-space: nowrap;
        // overflow: hidden;
        // text-overflow: ellipsis;
    }

    .send_msg {
        background-color: #57b0b7;
        border: none;
        border-radius: 50%;
        min-width: 1.8rem;
        min-height: 1.8rem;
        color: white;
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-right: 1.2rem;

        p {
            font-size: 1rem;
        }
    }
}

.send_bottom {
    align-items: flex-end;
}

.recording {
    width: 100%;
    height: 0px;
    background-color: #3c45ff;
    transition: 0.3s;
    display: flex;
    justify-content: center;
    align-items: center;
    color: white;
    overflow: hidden;
    position: relative;
    z-index: 99999;

    .stopPic {
        font-size: 1.5rem;
        margin-right: 1rem;
    }

    canvas {
        position: absolute;
        opacity: 0.5;
    }

    .loading {
        width: 100%;
        height: 100%;
        position: absolute;
        left: 0;
        top: 0;
        background-color: #555555;
        display: flex;
        justify-content: center;
        align-items: center;

        .icon {
            width: 1.5rem;
            height: 1.5rem;
            margin-right: 0.5rem;

            img {
                width: 100%;
                height: 100%;
            }
        }

        .close {
            position: absolute;
            right: 1rem;
            top: 1rem;
            font-size: 1.2rem;
        }
    }
}

.recording_open {
    height: 250px;
}

.tags-container {
    position: absolute;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    min-width: 46.2rem;
    max-width: 46.2rem;
    z-index: 999;
    margin-top: 0.4rem;
    margin-bottom: 0.1rem;
    margin-left: 1.9rem;
}

@media (max-width: 768px) {
    .tags-container {
        min-width: 95%;
        max-width: 95%;
        left: 0;
        right: 0;
    }
}

.hot-tags {
    display: flex;
    flex-grow: 1;
    white-space: nowrap;
    flex-wrap: nowrap;
    overflow-x: hidden;
    gap: 0.5rem;
    transition: opacity 0.3s;
    width: 100%;
    min-width: none;
    margin-left: 1.3%;
    padding-top: 0.3rem;

    &.hidden {
        opacity: 0;
        pointer-events: none;
    }

    .tag {
        background-color: var(--theme-color);
        color: white;
        border-radius: 1rem;
        cursor: pointer;
        transition: background-color 0.3s, transform 0.3s ease, box-shadow 0.3s ease;
        font-size: 0.95rem;
        margin-left: 0.2rem;
        margin-bottom: 0.3rem;
        padding: 0.4rem 0.8rem;

        &:hover {
            filter: brightness(107%);
            transform: translateY(-4px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }

        // 手機版觸摸效果
        &.tag-active {
            filter: brightness(107%);
            transform: scale(1.08);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
    }
}

@media (hover: none) {
    .hot-tags .tag:hover {
        filter: none !important;
        transform: none !important;
        box-shadow: none !important;
    }
}

.toggle-button {
    background-color: var(--theme-color);
    color: white;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: background-color 0.3s;
    width: 2rem;
    height: 2rem;

    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0 1rem;

    &:hover {
        filter: brightness(90%);
    }
}

.global-drag-overlay.animated {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.3s ease;
}

.animated .drag-message {
    background-color: white;
    border-radius: 12px;
    padding: 3rem;
    text-align: center;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
    max-width: 400px;
    width: 90%;
}

.animated .drop-zone {
    position: relative;
    padding: 2rem;
}

.animated .animated-border {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border: 2px dashed #3c45ff;
    border-radius: 8px;
    animation: borderPulse 2s infinite;
}

.animated .icon-wrapper {
    width: 70px;
    height: 70px;
    margin: 0 auto 1.5rem;
    background-color: rgba(60, 69, 255, 0.1);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.animated .icon-wrapper i {
    color: #3c45ff;
    font-size: 2rem;
    animation: bounceIcon 2s infinite;
}

.animated h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #222;
}

.animated p {
    font-size: 1rem;
    color: #666;
    margin: 0;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

@keyframes borderPulse {
    0% {
        transform: scale(1);
        opacity: 1;
    }
    50% {
        transform: scale(1.05);
        opacity: 0.7;
    }
    100% {
        transform: scale(1);
        opacity: 1;
    }
}

@keyframes bounceIcon {
    0%,
    20%,
    50%,
    80%,
    100% {
        transform: translateY(0);
    }
    40% {
        transform: translateY(-10px);
    }
    60% {
        transform: translateY(-5px);
    }
}
</style>
