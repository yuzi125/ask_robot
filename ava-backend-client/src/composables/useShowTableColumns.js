import { computed, ref, watch } from "vue";
import { useLocalStorage } from "@vueuse/core";

export function useShowTableColumns(config) {
    const { columnLabels, allColumns, storageKey, requiredFields } = config;

    // 使用 useLocalStorage 管理欄位顯示
    const visibleColumnsIndices = useLocalStorage(
        storageKey,
        allColumns.map((_, index) => index)
    );

    // 創建一個 ref 來管理可見欄位
    const visibleColumns = ref(
        visibleColumnsIndices.value.filter((index) => index < allColumns.length).map((index) => allColumns[index])
    );

    // 只監聽 visibleColumnsIndices 的變化
    watch(visibleColumnsIndices, (newIndices) => {
        visibleColumns.value = newIndices
            .filter((index) => index < allColumns.length)
            .map((index) => allColumns[index]);
    });

    // 處理欄位變更
    const handleColumnChange = (newIndices) => {
        visibleColumnsIndices.value = newIndices;
    };

    return {
        columnLabels,
        allColumns,
        requiredFields,
        visibleColumns,
        handleColumnChange,
    };
}
