<script setup>
import { inject, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import ContactComponents from "../components/ContactComponents.vue";
import NavbarComponents from "../components/NavbarComponents.vue";
import HintsComponents from "../components/HintsComponents.vue";
import InputMessageComponents from "../components/InputMessageComponents.vue";
import RecommendComponents from "../components/RecommendComponents.vue";
import SlideBottomComponents from "../components/SlideBottomComponents.vue";
import TermsDialog from "../components/TermsDialog.vue";
import CmdComponents from "../components/CmdComponents.vue";
import TunnelFormComponents from "../components/TunnelFormComponents.vue";
import { useStateStore, useSettingsStore, useApiStatusStore } from "../store/index";
import { storeToRefs } from "pinia";
const route = useRoute();
const router = useRouter();
const apiStatusStore = useApiStatusStore();
const stateStore = useStateStore();
const { chatPartner, isOpenMenu, isWaitRes } = storeToRefs(stateStore);
const settingsStore = useSettingsStore();

const {
    system_version,
    bulletin,
    theme,
    guest_enable,
    conversation_direction,
    welcome_word_update_frequency,
    show_source_chunk,
    show_extra_chunk,
    is_maintenance,
    enable_rtc_recording,
    max_message_length,
    chat_input_height,
    chat_input_placeholder,
    agreement_alert,
    current_environment,
    chat_file_upload_enable,
    chat_file_translate_enable,
} = storeToRefs(settingsStore);

const single = computed(() => route.query.single == "true");

//聊天對像(預設機器人)
// const chatPartner = ref({ partner: "bot",roomId:"bot", nickname: systemName.value, avatar: systemAvatar.value });

function openMenu(state) {
    isOpenMenu.value = state;
}

const axios = inject("axios");
async function init() {
    apiStatusStore.registerRequest();
    try {
        let rs = await axios.get("/system/settings");
        if (rs.data.code === 0) {
            rs = rs.data.data;
            system_version.value = rs.system_version;
            bulletin.value = rs.bulletin;
            guest_enable.value = rs.guest_enable;
            conversation_direction.value = rs.conversation_direction;
            welcome_word_update_frequency.value = rs.welcome_word_update_frequency;
            show_source_chunk.value = rs.show_source_chunk;
            show_extra_chunk.value = rs.show_extra_chunk;
            is_maintenance.value = rs.is_maintenance;
            enable_rtc_recording.value = rs.enable_rtc_recording;
            max_message_length.value = rs.max_message_length;
            chat_input_height.value = rs.chat_input_height;
            chat_input_placeholder.value = rs.chat_input_placeholder;
            agreement_alert.value = rs.agreement_alert;
            current_environment.value = rs.current_environment;
            chat_file_upload_enable.value = rs.chat_file_upload_enable;
            chat_file_translate_enable.value = rs.chat_file_translate_enable;
        }
        if (is_maintenance.value === "1") {
            router.push("/maintenance");
        }
    } catch (error) {
        console.log("init error", error);
    } finally {
        apiStatusStore.markRequestComplete();
    }
}
init();

const handleAccept = () => {
    console.log("用戶已同意條款");
};
</script>

<template>
    <TermsDialog :onAccept="handleAccept" />
    <div class="homeview">
        <div
            class="contact"
            :class="{
                'menu-open': isOpenMenu,
                'menu-closed': !isOpenMenu,
            }"
            v-if="!single"
        >
            <ContactComponents></ContactComponents>
        </div>

        <div
            class="msgView"
            :class="{
                openMenu: isOpenMenu,
                single: single,
                'menu-closed': !isOpenMenu,
            }"
        >
            <div class="layer" v-if="isOpenMenu" @click="isOpenMenu = false"></div>
            <NavbarComponents @switch="openMenu" :isOpen="isOpenMenu" :chatPartner="chatPartner"></NavbarComponents>

            <router-view> </router-view>
            <div class="inputMsg">
                <SlideBottomComponents></SlideBottomComponents>
                <div v-if="chatPartner.partner == 'bot'" class="inputMsgCenter">
                    <CmdComponents></CmdComponents>
                    <RecommendComponents></RecommendComponents>
                    <!-- <TunnelFormComponents></TunnelFormComponents> -->
                    <HintsComponents></HintsComponents>
                </div>
                <div class="inputMsgCenter">
                    <InputMessageComponents></InputMessageComponents>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.wait_res {
    pointer-events: none;
}
.homeview {
    width: 100%;
    height: 100%;
    position: relative;

    .contact {
        width: calc(75% - 2rem);
        height: 100%;
        position: absolute;
        top: 0;
        left: 1rem;
        overflow: hidden;
        // 行動版預設隱藏（透過 transform 移出視窗）
        transform: translateX(-100%);
        transition: transform 0.3s ease;

        // 當 isOpenMenu 為 true 時才顯示
        &.menu-open {
            transform: translateX(0);
        }
    }

    .msgView {
        width: 100%;
        height: 100%;
        transition: transform 0.3s ease;
        background-color: var(--chat-bg-color);
        position: absolute;
        left: 0;
        top: 0;

        .layer {
            position: absolute;
            width: 100%;
            height: 100%;
            z-index: 100000;
            background-color: black;
            opacity: 0.2;
            pointer-events: auto;
            display: none;
        }

        .inputMsg {
            width: 100%;
            position: absolute;
            bottom: 0;
            background-color: var(--input-bg-color);
        }

        // 行動版：當選單開啟時，將訊息視窗推到右邊
        &.openMenu {
            transform: translateX(75%);
            pointer-events: none;
            overflow: hidden;
            cursor: pointer;

            .layer {
                display: block;
            }
        }

        // single 模式在手機版也確保正確顯示
        &.single {
            width: 100% !important;
            left: 0 !important;
            transform: none !important;
            pointer-events: auto !important;
            overflow: visible !important;
            cursor: auto !important;

            .layer {
                display: none !important;
            }
        }
    }
}

.contact-leave-from {
    opacity: 1;
}
.contact-leave-active {
    transition: 0.3s;
}
.contact-leave-to {
    opacity: 1;
}

@media (min-width: 768px) {
    .homeview {
        .contact {
            left: 0;
            width: 280px;
            border-radius: 0;
            // 桌面版：預設顯示選單
            transform: translateX(0);

            // 當選單要隱藏時
            &.menu-closed {
                transform: translateX(-100%);
            }
        }

        .msgView {
            width: calc(100% - 283px);
            left: 283px;
            display: flex;
            flex-direction: column;
            transform: none;
            transition: all 0.3s ease;

            .layer {
                display: none !important;
            }

            .inputMsg {
                .inputMsgCenter {
                    margin: 0 auto;
                    max-width: 768px;
                }
            }

            // 當選單隱藏時，訊息視窗佔滿全寬
            &.menu-closed {
                width: 100%;
                left: 0;
            }

            // single 模式優先級最高
            &.single {
                width: 100% !important;
                left: 0 !important;
            }
        }

        // 桌面版的 openMenu 行為（保留原始邏輯以防需要）
        .msgView.openMenu {
            transform: none;
            border-radius: 0;
            pointer-events: auto;
            cursor: auto;
            width: calc(100% - 283px);
            left: 283px;
        }
    }
}
</style>
