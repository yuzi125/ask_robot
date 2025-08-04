<script setup>
import { ref, computed, inject } from "vue";

const props = defineProps({
    fileData: {
        type: Object,
        required: true,
    },
    forms: {
        type: Array,
        default: () => [],
    },
    showBindDocumentSelect: {
        type: Boolean,
        default: false,
    },
    formInfo: {
        type: Object,
        required: true,
    },
});

const emit = defineEmits(["update:modelValue", "bindAll", "unbindFormDoc", "refetch"]);
const emitter = inject("emitter");
const selectedFiles = ref([]);
// 將文件用群組分類
const groupedFiles = computed(() => {
    return Object.entries(props.fileData).flatMap(([groupName, files]) => [
        { header: groupName, divider: true, groupName },
        ...files.map((file) => ({
            ...file,
            title: file.originalname,
            value: file.id,
            groupName,
        })),
    ]);
});

const flattenedFiles = computed(() => {
    return Object.entries(props.fileData).flatMap(([groupName, files]) =>
        files.map((file) => ({ ...file, groupName }))
    );
});
const filterFiles = (item, queryText, itemText) => {
    if (item.header) {
        return true;
    }

    const hasValue = (val) => (val != null ? val : "");
    const text = hasValue(itemText);
    const query = hasValue(queryText);

    return text.toString().toLowerCase().indexOf(query.toString().toLowerCase()) > -1;
};
const handleSelectionChange = (newSelection) => {
    const validSelection = newSelection.flatMap((item) => {
        if (item.id && item.originalname) {
            return [item];
        }

        const matchedFiles = flattenedFiles.value.filter((file) => file.originalname === item);

        if (matchedFiles.length > 0) {
            return matchedFiles;
        } else if (typeof item === "string") {
            emitter.emit("openSnackbar", { message: `文件 "${item}" 不存在`, color: "warning" });
        }

        return [];
    });

    selectedFiles.value = validSelection.map((item) => ({
        ...item,
        title: item.originalname || item.title,
        value: item.id,
        groupName: item.groupName,
        uniqueKey: `${item.id}-${item.groupName}`,
    }));

    emit("update:modelValue", selectedFiles.value);
};

const removeSelectedFile = (item) => {
    selectedFiles.value = selectedFiles.value.filter((file) => file.id !== item.id);
    handleSelectionChange(selectedFiles.value);
};

const selectedFilesCount = computed(() => selectedFiles.value.length);

const selectedFilesGrouped = computed(() => {
    const groups = {};
    selectedFiles.value.forEach((file) => {
        if (!groups[file.groupName]) {
            groups[file.groupName] = [];
        }
        groups[file.groupName].push(file);
    });
    return groups;
});

const formsGrouped = computed(() => {
    const groups = {};
    props.forms.forEach((form) => {
        if (!groups[form.datasets_name]) {
            groups[form.datasets_name] = [];
        }
        groups[form.datasets_name].push(form);
    });
    return groups;
});

const hasBoundFiles = computed(() => props.forms.length > 0);

const handleBindAll = () => {
    emit("bindAll", {
        files: selectedFiles.value,
        formInfo: props.formInfo,
    });
    selectedFiles.value = [];
};

const handleUnbindFormDoc = (index, form) => {
    emit("unbindFormDoc", index, form);
    emit("refetch");
};

const isGroupSelected = (groupName) => {
    const groupFiles = flattenedFiles.value.filter((file) => file.groupName === groupName);
    return groupFiles.every((file) => selectedFiles.value.some((selected) => selected.id === file.id));
};

const handleGroupSelection = (groupName, event) => {
    const isSelected = event.target.checked;

    const groupFiles = flattenedFiles.value.filter((file) => file.groupName === groupName);

    if (isSelected) {
        const newSelectedFiles = groupFiles.map((file) => ({
            ...file,
            title: file.originalname,
            value: file.id,
        }));
        selectedFiles.value = [
            ...selectedFiles.value.filter((file) => file.groupName !== groupName),
            ...newSelectedFiles,
        ];
    } else {
        selectedFiles.value = selectedFiles.value.filter((file) => file.groupName !== groupName);
    }

    handleSelectionChange(selectedFiles.value);
};

const getFileTitle = (item) => {
    let title = item.title || item.originalname || "Untitled";

    return title;
};

const isFileDataEmpty = (obj) => {
    return Object.keys(obj).length === 0;
};
</script>

<template>
    <div class="bindDocumentContainer">
        <template v-if="showBindDocumentSelect">
            <v-combobox
                v-model="selectedFiles"
                :items="groupedFiles"
                item-title="title"
                item-value="id"
                label="選擇要綁定的文件"
                multiple
                chips
                closable-chips
                @update:model-value="handleSelectionChange"
                return-object
                :disabled="isFileDataEmpty(fileData)"
                :filter="filterFiles"
            >
                <template v-slot:chip="{ props, item }">
                    <v-chip v-bind="props" class="custom-chip" closable @click:close="removeSelectedFile(item)">
                        {{ getFileTitle(item) }}
                    </v-chip>
                </template>
                <template v-slot:item="{ item, props }">
                    <v-list-item
                        v-if="item.raw?.header"
                        :title="item.raw.header"
                        class="group-header d-flex align-center"
                    >
                        <template v-slot:prepend>
                            <div class="d-flex align-center">
                                <v-checkbox
                                    :model-value="isGroupSelected(item.raw.groupName)"
                                    @change="handleGroupSelection(item.raw.groupName, $event)"
                                    class="mt-0 mr-2"
                                    hide-details
                                ></v-checkbox>
                                <v-icon icon="mdi-folder" color="primary"></v-icon>
                            </div>
                        </template>
                    </v-list-item>
                    <v-list-item
                        v-else
                        v-bind="props"
                        :title="getFileTitle(item.raw)"
                        :subtitle="item.raw.groupName"
                        class="group-item"
                    >
                        <template v-slot:prepend>
                            <v-icon icon="mdi-file-outline" size="small"></v-icon>
                        </template>
                    </v-list-item>
                </template>
            </v-combobox>
        </template>

        <v-expand-transition>
            <div v-if="selectedFilesCount > 0" class="mt-4">
                <v-card class="mb-2">
                    <v-card-title class="d-flex justify-space-between align-center">
                        已選擇的文件 ({{ selectedFilesCount }})
                        <div>
                            <v-btn color="primary" @click="handleBindAll" size="small" class="mr-2">全部綁定</v-btn>
                            <v-btn
                                color="error"
                                @click="
                                    selectedFiles = [];
                                    handleSelectionChange([]);
                                "
                                size="small"
                                >移除全部</v-btn
                            >
                        </div>
                    </v-card-title>
                    <v-card-text style="max-height: 300px; overflow-y: auto">
                        <v-expansion-panels>
                            <v-expansion-panel v-for="(files, groupName) in selectedFilesGrouped" :key="groupName">
                                <v-expansion-panel-title>
                                    {{ groupName }} ({{ files.length }})
                                </v-expansion-panel-title>
                                <v-expansion-panel-text>
                                    <v-list density="compact">
                                        <v-list-item
                                            v-for="file in files"
                                            :key="file.id"
                                            :title="getFileTitle(file)"
                                            :subtitle="`ID: ${file.id}`"
                                        >
                                            <template v-slot:append>
                                                <v-btn size="small" color="error" @click="removeSelectedFile(file)"
                                                    >移除文件</v-btn
                                                >
                                            </template>
                                        </v-list-item>
                                    </v-list>
                                </v-expansion-panel-text>
                            </v-expansion-panel>
                        </v-expansion-panels>
                    </v-card-text>
                </v-card>
            </div>
        </v-expand-transition>

        <v-card v-if="hasBoundFiles" class="mt-4 mb-4">
            <v-card-title>已綁定文件</v-card-title>
            <v-card-text>
                <v-expansion-panels>
                    <v-expansion-panel v-for="(forms, groupName) in formsGrouped" :key="groupName">
                        <v-expansion-panel-title> {{ groupName }} ({{ forms.length }}) </v-expansion-panel-title>
                        <v-expansion-panel-text>
                            <v-list density="compact">
                                <v-list-item
                                    v-for="(form, index) in forms"
                                    :key="index"
                                    :title="form.name"
                                    :subtitle="`ID: ${form.document_id}`"
                                >
                                    <template v-slot:append>
                                        <v-btn color="error" size="small" @click="handleUnbindFormDoc(index, form)"
                                            >取消绑定</v-btn
                                        >
                                    </template>
                                </v-list-item>
                            </v-list>
                        </v-expansion-panel-text>
                    </v-expansion-panel>
                </v-expansion-panels>
            </v-card-text>
        </v-card>
    </div>
</template>
