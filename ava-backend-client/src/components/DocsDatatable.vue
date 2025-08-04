<template>
    <v-container>
        <v-data-table :headers="visibleHeaders" :items="items" item-value="id" v-model:expanded="expanded">
            <template v-slot:[`item.${extraColumnHeader}`]="{ item }">
                <v-btn icon @click="toggleExtra(item)">
                    <v-icon>{{ expanded.includes(item.id) ? "mdi-minus" : "mdi-plus" }}</v-icon>
                </v-btn>
            </template>
            <template v-slot:expanded-row="{ columns, item }">
                <tr>
                    <td :colspan="columns.length">
                        <v-container>
                            <v-row>
                                <v-col v-for="header in hiddenHeaders" :key="header.value" cols="12">
                                    <strong>{{ header.title }}:</strong> {{ item[header.value] }}
                                </v-col>
                            </v-row>
                        </v-container>
                    </td>
                </tr>
            </template>
        </v-data-table>
    </v-container>
</template>

<script setup>
import { ref, computed } from "vue";
import { useResizeObserver } from "@vueuse/core";

const items = ref([
    {
        id: crypto.randomUUID(),
        documentName: "5月11、18日_活動名次登記.pdf",
        uploadTime: "2024-06-03 17:57:52",
        updateTime: "2024-06-06 14:45:22",
        separator: "系統預設",
        status: "建立成功",
        enabled: "1",
        operate: "test",
        showExtra: false,
    },
    {
        id: crypto.randomUUID(),
        documentName: "African Elephant",
        uploadTime: "Loxodonta africana",
        updateTime: "Herbivore",
        separator: "Savanna",
        status: "60-70 years",
        enabled: "1",
        operate: "test",
        showExtra: false,
    },
    // ... more items
]);

const headers = ref([
    { title: "", value: "expand" },
    { title: "#", value: "id" },
    { title: "文件名", value: "documentName" },
    { title: "上傳時間", value: "uploadTime" },
    { title: "更新時間", value: "updateTime" },
    { title: "切分符號", value: "separator" },
    { title: "狀態", value: "status" },
    { title: "啟用", value: "enabled" },
    { title: "操作", value: "operate" },
]);

const extraColumnHeader = "expand";
const expanded = ref([]);

const visibleColumns = ref(5);

const visibleHeaders = computed(() => {
    const visible = headers.value.slice(0, visibleColumns.value);
    const fixedColumns = headers.value.slice(-2);
    return [...visible, ...fixedColumns];
});

const hiddenHeaders = computed(() => {
    // 不要隱藏操作和啟用欄位
    const hidden = headers.value.slice(visibleColumns.value, -2);
    return hidden;
});

const updateVisibleColumns = (width) => {
    if (width < 600) {
        visibleColumns.value = 2;
    } else if (width < 900) {
        visibleColumns.value = 3;
    } else if (width < 1200) {
        visibleColumns.value = 4;
    } else {
        visibleColumns.value = 5;
    }
};

const toggleExtra = (item) => {
    const index = expanded.value.indexOf(item.id);
    if (index > -1) {
        expanded.value.splice(index, 1);
    } else {
        expanded.value.push(item.id);
    }
};

useResizeObserver(document.body, (entries) => {
    const { width } = entries[0].contentRect;
    updateVisibleColumns(width);
});
</script>
