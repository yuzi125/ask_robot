<script setup>
import { inject, nextTick, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
const router = useRouter();
import ContactComponents from "@/components/ContactComponents.vue";

import NavbarComponents from "@/components/kaohsiung/NavbarComponents.vue";
import HintsComponents from "@/components/HintsComponents.vue";
import InputMessageComponents from "@/components/kaohsiung/InputMessageComponents.vue";
import RecommendComponents from "@/components/kaohsiung/RecommendComponents.vue";
import SlideBottomComponents from "@/components/SlideBottomComponents.vue";
import TermsDialog from "@/components/TermsDialog.vue";

import CmdComponents from "@/components/CmdComponents.vue";
import { useStateStore, useSettingsStore, useApiStatusStore } from "@/store/index";
import { storeToRefs } from "pinia";

const apiStatusStore = useApiStatusStore();
const stateStore = useStateStore();
const { chatPartner, isOpenMenu } = storeToRefs(stateStore);
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
    chat_input_height,
    chat_input_placeholder,
    agreement_alert,
    current_environment,
    chat_file_upload_enable,
    chat_file_translate_enable,
} = storeToRefs(settingsStore);

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
        <div class="contact">
            <ContactComponents></ContactComponents>
        </div>
        <div class="msgView">
            <!-- <div class="layer"></div> -->
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

    .openMenu {
        transform: translateX(75%);
        /* border-radius: 0.7rem; */
        pointer-events: none;
        overflow: hidden;
        cursor: pointer;
    }
    .msgView {
        width: 100%;
        height: 100%;
        transition: 0.3s;
        background-color: var(--chat-bg-color);
        position: absolute;
        left: 0;
        top: 0;
        // transform: translateX(75%);

        .layer {
            position: absolute;
            width: 100%;
            height: 100%;
            z-index: 1000;
            background-color: black;
            opacity: 0.2;
            pointer-events: auto;
        }

        .inputMsg {
            width: 100%;
            position: absolute;
            bottom: 0;
            background-color: var(--input-bg-color);
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
            // position: static;
            left: 0;
            width: 280px;
            border-radius: 0;
        }

        .msgView {
            width: 100%;
            // max-width: 768px;
            // left: calc(145px + 50%);
            /* left: 283px; */
            // transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            .layer {
                width: 0%;
                height: 0%;
            }
            .inputMsg {
                // margin: 0 auto;
                // max-width: 768px;
                // left: 50%;
                // transform: translateX(-50%);
                .inputMsgCenter {
                    margin: 0 auto;
                    max-width: 768px;
                }
            }
        }
        .openMenu {
            transform: none;
            border-radius: 0;
            pointer-events: auto;
            cursor: auto;
            transform: translateX(-283px);
            width: 100%;
        }
    }
}
</style>
