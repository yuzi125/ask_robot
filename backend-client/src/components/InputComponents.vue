<script setup>
import { ref, getCurrentInstance, watch, computed, defineExpose } from "vue";
import SelectPanelComponents from "./SelectPanelComponents.vue";

const props = defineProps({
    data: { type: Object, default: {} },
    label: { type: String, default: "" },
    btnEdit: { type: Boolean, default: true },
    btnDel: { type: Boolean, default: false },
    rows: { type: Number, default: 2 },
    class: { type: String, default: "" },
    loading: { type: Boolean, default: false },
    colorPicker: { type: Boolean, default: false },
    preview: { type: Boolean, default: false },
    isPassword: { type: Boolean, default: false },
    autocomplete: { type: Boolean, default: false },
    variant: { type: String },
    scope: { type: String, default: "" },
    datasets_id: { type: String, default: "" },
    documents: { type: Object, default: {} },
    documentError: { type: Object, default: {} },
    isLoadingDocuments: { type: Boolean, default: false },
    refetchDocuments: { type: Function, default: () => {} },
    disabled: { type: Boolean, default: false },
});
const emit = defineEmits(["del", "send", "change", "enterEditMode", "exitEditMode"]);

const multiline = ref(false);
const hint = ref("");
const attrs = getCurrentInstance().attrs;

if ("hint" in attrs) {
    hint.value = attrs.hint;
}
if ("multiline" in attrs) {
    multiline.value = true;
}

const changeEdit = function (data) {
    data.edit = !data.edit;
    if (data.edit) {
        data.originalText = data.text;
        data.originalColor = data.color;
        emit("enterEditMode");
    } else {
        data.text = data.originalText;
        data.color = data.originalColor;
        delete data.originalText;
        delete data.originalColor;
        emit("exitEditMode");
    }
};

const del = function (data) {
    emit("del", data);
};

const computedClass = computed(() => {
    let classList = ["flex-grow-1"];
    if (props.class) {
        classList.push(props.class);
    }
    if (props.preview) {
        classList.push("preview-textarea");
    }
    return classList;
});

const send = function (data) {
    if (data.text !== data.originalText || data.color !== data.originalColor) {
        data.edit = false;
        emit("send", data);
        emit("exitEditMode");
    }
};

watch(
    () => props.data.color,
    (newColor) => {
        if (props.colorPicker && newColor && props.data.edit) {
            props.data.text = newColor;
        }
    }
);

const selectPanelRef = ref(null);

const openSelectPanel = (data) => {
    if (selectPanelRef.value && data.text !== data.originalText) {
        selectPanelRef.value.open();
    }
};

const closeSelectPanel = () => {
    if (selectPanelRef.value) {
        selectPanelRef.value.close();
    }
};

const sendSelectPanel = async function (data) {
    props.data.edit = false;
    const emitData = {
        item: props.data,
        data: data,
    };
    emit("send", emitData);
};

defineExpose({
    openSelectPanel,
});
</script>

<template>
    <div class="textarea_com" :class="{ 'preview-mode': preview }">
        <div class="input-flex-row">
            <!-- 單行文字 -->
            <v-text-field
                v-if="!multiline"
                :label="label"
                v-model="data.text"
                :readonly="!data.edit"
                :disabled="disabled"
                :class="[props.class, { 'edit-mode': data.edit }]"
                :loading="loading"
                :type="props.isPassword && !data.edit ? 'password' : 'text'"
                :autocomplete="props.autocomplete"
                :variant="variant || 'outlined'"
                :hint="hint"
                persistent-hint
                density="comfortable"
            ></v-text-field>
            <!-- 多行文字 -->
            <v-textarea
                v-else
                :label="label"
                v-model="data.text"
                :readonly="!data.edit"
                :disabled="disabled"
                :class="[computedClass, { 'edit-mode': data.edit }]"
                :loading="loading"
                :hint="hint"
                :auto-grow="preview"
                :rows="preview ? 1 : rows"
                no-resize
                persistent-hint
                :variant="variant || 'outlined'"
                density="comfortable"
            ></v-textarea>

            <!-- 編輯模式下的儲存/取消圖標 -->
            <div v-if="data.edit && !disabled" class="edit-actions">
                <v-icon
                    icon="mdi-check"
                    color="success"
                    size="small"
                    @click="props.scope === 'content_replacement_list' ? openSelectPanel(data) : send(data)"
                    class="action-icon"
                >
                    <v-tooltip activator="parent" location="top">儲存</v-tooltip>
                </v-icon>
                <v-icon icon="mdi-close" color="error" size="small" @click="changeEdit(data)" class="ml-2 action-icon">
                    <v-tooltip activator="parent" location="top">取消</v-tooltip>
                </v-icon>
            </div>
        </div>

        <!-- 非編輯模式下的編輯/刪除圖標 -->
        <div class="control-icons" v-if="!data.edit && !disabled">
            <v-icon
                v-if="btnEdit"
                icon="mdi-pencil"
                color="primary"
                size="small"
                @click="changeEdit(data)"
                class="action-icon"
            >
                <v-tooltip activator="parent" location="top">編輯</v-tooltip>
            </v-icon>
            <v-icon
                v-if="btnDel"
                icon="mdi-delete"
                color="error"
                size="small"
                @click="del(data)"
                class="ml-2 action-icon"
            >
                <v-tooltip activator="parent" location="top">刪除</v-tooltip>
            </v-icon>
            <slot name="btn" v-if="$slots.btn"></slot>
        </div>

        <SelectPanelComponents
            ref="selectPanelRef"
            :title="'內容替換後embedding'"
            :placeholder="'自訂embedding的檔案:'"
            :data="props.data"
            :datasets_id="props.scope === 'content_replacement_list' ? props.datasets_id : ''"
            :documents="props.documents"
            :documentError="props.documentError"
            :isLoadingDocuments="props.isLoadingDocuments"
            :refetchDocuments="props.refetchDocuments"
            @confirmSelection="sendSelectPanel"
            @cancelSelection="closeSelectPanel"
        />
    </div>
</template>

<style lang="scss" scoped>
.textarea_com {
    display: flex;
    flex-direction: column;
    width: 100%;
    word-break: break-all;
    position: relative;
    margin-bottom: 1rem;

}

.input-flex-row {
    display: flex;
    align-items: stretch;
    width: 100%;
    position: relative;

    :deep(.v-field__outline) {
        color: rgba(0, 0, 0, 0.38);
    }

    :deep(.v-field__input) {
        font-size: 0.95rem;
    }

    :deep(.v-field--focused .v-field__outline) {
        color: #1976d2;
    }

    :deep(.v-label) {
        color: rgba(0, 0, 0, 0.6);
        font-size: 0.95rem;
        font-weight: 400;
    }

    :deep(.v-field--focused .v-label) {
        color: #1976d2;
    }
}

.preview-textarea {
    :deep(.v-input) {
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    :deep(.v-input__control) {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
    }

    :deep(.v-field__field) {
        flex-grow: 1;
    }

    :deep(textarea) {
        max-height: none !important;
        height: 100% !important;
    }
}

.edit-mode {
    :deep(.v-field) {
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
}

.edit-actions {
    position: absolute;
    right: 10px;
    top: 10px;
    display: flex;
    z-index: 2;
}

.control-icons {
    position: absolute;
    right: 10px;
    top: 10px;
    display: flex;
    z-index: 2;
}

.action-icon {
    cursor: pointer;
    opacity: 0.7;
    transition: all 0.2s ease;
    border-radius: 50%;
    padding: 4px;
    background-color: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(2px);

    &:hover {
        opacity: 1;
        background-color: rgba(255, 255, 255, 0.95);
        transform: scale(1.1);
    }
}

.ml-2 {
    margin-left: 8px;
}

:deep(.v-messages) {
    color: rgba(0, 0, 0, 0.6);
    font-size: 0.75rem;
    padding: 4px 12px;
}

:deep(.v-progress-linear) {
    color: #1976d2;
}
</style>
