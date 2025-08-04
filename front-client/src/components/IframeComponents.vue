<script setup>
import { inject, ref, toRefs } from "vue";
import { useRouter } from "vue-router";
import { useUserStore, useStateStore } from "../store/index";
import { storeToRefs } from "pinia";
import html2canvas from "html2canvas";
const userStore = useUserStore();
const { contactList } = storeToRefs(userStore);
const stateStore = useStateStore();
const { isOpenMenu } = storeToRefs(stateStore);
const axios = inject("axios");
const props = defineProps({
    data: { type: Object, default: {} },
});

const { data } = toRefs(props);

const iframeBox = ref(null);
const navbarDom = ref(null);
const iframeDom = ref(null);
const canvasDom = ref(null);

const full_screen = ref(false);

const navbar_switch = ref(false);
const isHorizontal = ref(false);

const router = useRouter();

async function screenshot() {
    if (!iframeDom.value.contentDocument) {
        return undefined;
    }
    const iframeBody = iframeDom.value.contentDocument.body;
    const divScreenshot = await html2canvas(iframeBody, { willReadFrequently: true });
    const imageBlob = await new Promise((resolve) => {
        divScreenshot.toBlob((blob) => {
            resolve(blob);
        });
    });

    return imageBlob;
}
async function createUserRoom(roomId, toUid) {
    //沒有房間建立一個
    if (!roomId) {
        let rs = await axios.post("/contact/room", JSON.stringify({ user2Uid: toUid }));
        // contactList.value.find((f) => f.uid == chatPartner.value.uid).roomId = rs.data.data.roomId;
        return rs.data.data.roomId;
    }
}
async function shareContact() {
    const imageBlob = await screenshot();
    if (!imageBlob) {
        console.log("可能有權限問題取不到iframe內容");
        return;
    }
    //到時根據工號找到uid，先預設Jeason
    let toUid = "3b78c6be-3769-43a7-be1a-f01e9f79a80c";
    let item = contactList.value.find((f) => f.uid == toUid);
    if (!item.roomId) {
        item.roomId = await createUserRoom(item.roomId, toUid);
    }
    const formData = new FormData();
    formData.append("file", imageBlob);
    formData.append("toUid", toUid);
    formData.append("roomId", item.roomId);

    axios.post("/contact/share", formData, { headers: { "Content-Type": "multipart/form-data" } });
    isOpenMenu.value = true;
    setTimeout(() => {
        router.replace("/u/" + item.roomId);
        isOpenMenu.value = false;
    }, 500);
}

function fullScreen() {
    iframeBox.value.classList.add("full_screen");
    full_screen.value = true;
    iframeDom.value.style = "height:calc(100vh - 1rem)";
    iframeBox.value.classList.add("navbar_hide");
    if (data.value.needReload) {
        iframeDom.value.contentWindow.location.reload();
    }
}
function unFullScreen() {
    iframeBox.value.classList.remove("full_screen");
    full_screen.value = false;
    iframeDom.value.style = "height:300";
    iframeBox.value.classList.remove("navbar_hide");
    navbar_switch.value = false;
    isHorizontal.value = false;
    iframeBox.value.classList.remove("screen_horizontal");

    if (data.value.needReload) {
        iframeDom.value.contentWindow.location.reload();
    }
}

function switchNav() {
    if (navbar_switch.value) {
        iframeBox.value.classList.add("navbar_hide");
        navbar_switch.value = false;
    } else {
        iframeBox.value.classList.remove("navbar_hide");
        navbar_switch.value = true;
    }
}
function changeDirection() {
    if (!isHorizontal.value) {
        iframeBox.value.classList.add("screen_horizontal");
        fullScreen();
        isHorizontal.value = true;
    } else {
        iframeBox.value.classList.remove("screen_horizontal");
        unFullScreen();
        isHorizontal.value = false;
        navbar_switch.value = false;
    }
}
</script>

<template>
    <div class="iframe_box" ref="iframeBox">
        <div class="content">
            <div class="navbar" ref="navbarDom">
                <p class="title">{{ data.title }}</p>
                <!-- <p class="subject">{{ data.subject }}</p> -->
                <div class="right">
                    <div class="icon share">
                        <p @click="shareContact"><i class="fa-solid fa-share-from-square"></i></p>
                    </div>
                    <div class="icon switch" v-if="!data.needHorizontal">
                        <p v-if="!full_screen" @click="fullScreen"><i class="fa-solid fa-maximize"></i></p>
                        <p v-else @click="unFullScreen"><i class="fa-solid fa-minimize"></i></p>
                    </div>
                    <div class="icon horiz" v-else>
                        <p @click="changeDirection"><i class="fa-solid fa-expand"></i></p>
                    </div>
                </div>
            </div>
            <div class="navbar_switch" v-if="full_screen && !isHorizontal" @click="switchNav">
                <p>chatAva</p>
                <div class="switch">
                    <p v-if="!navbar_switch"><i class="fa-solid fa-arrow-down"></i></p>
                    <p v-else><i class="fa-solid fa-arrow-up"></i></p>
                </div>
            </div>
            <div class="iframe">
                <iframe ref="iframeDom" width="100%" height="300px" :src="data.url" frameborder="0"></iframe>
                <div v-if="!full_screen" class="layer" style="width: 100%; height: 320px"></div>
            </div>
            <canvas ref="canvasDom" style="display: none"></canvas>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.iframe_box {
    background-color: #eeeeee;
    border-radius: 0.5rem;
    overflow: hidden;
    transition: 0.3s;
    .content {
        width: 100%;
        .navbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 1rem;
            height: 3rem;
            transition: 0.3s;
            overflow: hidden;
            .title {
                color: black;
                font-weight: bold;
                font-size: 1.2rem;
            }
            .subject {
                color: black;
            }
            .right {
                display: flex;
                .icon {
                    color: #9a9aa0;
                    cursor: pointer;
                    margin-right: 1rem;
                    &:last-child {
                        margin-right: 0;
                    }
                }
            }
        }

        .navbar_switch {
            cursor: pointer;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 1rem;
            padding-right: 0.5rem;
            background-color: #3c45ff;
            font-size: 0.8rem;
            .switch {
                margin-left: 0.5rem;
                display: flex;
                align-items: center;
            }
        }
        .iframe {
            position: relative;
            iframe {
                transition: 0.3s;
            }
            .layer {
                position: absolute;
                top: 0;
                left: 0;
                background-color: rgba($color: #000000, $alpha: 0);
            }
        }
    }
}
.navbar_hide {
    transform: translateY(-3rem);
}
.full_screen {
    border-radius: 0;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 100;
    justify-content: center;
    width: 100%;
    height: calc(100% + 3rem);
    display: flex;
    touch-action: none;
}
.screen_horizontal {
    transform-origin: top left;
    transform: rotate(90deg) translateY(-100%);
    width: 100vh;
    height: 100vw;
    justify-content: flex-start;
    .content {
        width: 80%;
    }
}
</style>
