<script setup>
import { ref, computed, watch, inject } from "vue";
import FileComponents from "@/components/FileComponents.vue";
import FilePreview from "./FilePreview.vue";
import { SUPPORTED_EXTENSIONS } from "@/utils/common";
import FileDetail from "./FileDetail.vue";

const emitter = inject("emitter");
const props = defineProps({
    fileInfo: { type: Object, required: true },
    downloadHost: { type: String, required: true },
    modelValue: { type: Boolean, required: true },
});

const emit = defineEmits(['update:modelValue']);

const fileExtension = (filename, type = "all") => {
    const extension = filename.split(".").pop().toLowerCase();

    if (type === "all") {
        const allExtensions = Object.values(SUPPORTED_EXTENSIONS).flat();
        return allExtensions.includes(extension);
    }

    return SUPPORTED_EXTENSIONS[type]?.includes(extension) || false;
};

const isPDF = (filename) => {
    if (filename.endsWith(".pdf")) {
        return true;
    }
    return false;
};

const openExternalLink = (url) => {
    emitter.emit("openUrl", url);
};

const toggleSelection = () => {
    emit("update:modelValue", !props.modelValue);
};

const showDetail = ref(false);
const toggleDetail = () => {
    showDetail.value = !showDetail.value;
};
</script>

<template>
    <div class="custom-item" @click="toggleSelection">
        <div class="custom-file-item" style="display: flex; align-items: center; gap: 0.5rem;">
            <input
                type="checkbox"
                :id="props.fileInfo.id"
                :value="props.fileInfo.id"
                :checked="props.modelValue"
                @change="toggleSelection"
                @click.stop
            />
            <FileComponents :filename="props.fileInfo.originalname"></FileComponents>
        </div>

        <div class="d-flex align-center" style="margin-left: auto;">
            <a
                :href="props.downloadHost + props.fileInfo.filename + '?preview=true'"
                target="_blank"
                v-if="isPDF(props.fileInfo.filename)"
                @click.stop
            >
                <i class="fa-solid fa-eye icon-hover"></i>
                <v-tooltip activator="parent" location="top">
                    預覽 {{ props.fileInfo.originalname }}
                </v-tooltip>
            </a>            
            <FilePreview
                :fileInfo="props.fileInfo"
                :downloadHost="props.downloadHost"
                style="margin-left: auto; font-size: 0.9rem;"
                v-if="fileExtension(props.fileInfo.originalname)"
                @downloadFile="openExternalLink"
                @click.stop
            ></FilePreview>

            <button style="font-size: 1.2rem; margin-left: 0.2rem;" @click.stop="toggleDetail">
                <i class="mdi mdi-dots-vertical" style="opacity: 0.8;"></i>
                <v-tooltip activator="parent" location="top"> 更多資訊 </v-tooltip>
            </button>
        </div>
    </div>

    <FileDetail v-if="showDetail" :fileInfo="props.fileInfo" @close="showDetail = false"></FileDetail>
</template>

<style lang="scss" scoped>
.custom-item {
    background-color: #ffffff;
    padding: 0.5rem;
    padding-top: 0.7rem;
    padding-bottom: 0.7rem;
    padding-left: 0.77rem;
    padding-right: 0.35rem;
    border-radius: 0.2rem;
    display: flex;
    align-items: center;
    cursor: pointer;
    user-select: none;
}

.custom-file-item {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
}
</style>
