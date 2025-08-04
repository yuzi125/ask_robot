// src/views/APIKeyManagement/composables/usePagination.js
import { ref, computed, watch } from "vue";

export const usePagination = (items, searchQuery) => {
    const currentPage = ref(1);
    const itemsPerPage = ref(10);

    // 過濾後的項目
    const filteredItems = computed(() => {
        if (!items.value) return [];
        if (!searchQuery.value) return items.value;

        const query = searchQuery.value.toLowerCase();
        return items.value.filter(
            (item) =>
                item.User.name.toLowerCase().includes(query) ||
                item.key.toLowerCase().includes(query) ||
                item.User.description?.toLowerCase().includes(query) ||
                item.ApiKeyDomains.some((d) => d.domain.toLowerCase().includes(query))
        );
    });

    // 總頁數
    const totalPages = computed(() => {
        return Math.ceil(filteredItems.value.length / itemsPerPage.value);
    });

    // 當前頁的項目
    const paginatedItems = computed(() => {
        const start = (currentPage.value - 1) * itemsPerPage.value;
        const end = start + itemsPerPage.value;
        return filteredItems.value.slice(start, end);
    });

    // 確保當前頁碼在有效範圍內
    const validateCurrentPage = () => {
        if (currentPage.value > totalPages.value) {
            currentPage.value = Math.max(1, totalPages.value);
        }
    };

    // 監聽過濾和每頁顯示數量的變化
    watch([searchQuery, itemsPerPage], () => {
        currentPage.value = 1;
    });

    // 監聽總頁數變化
    watch(totalPages, validateCurrentPage);

    return {
        currentPage,
        itemsPerPage,
        filteredItems,
        paginatedItems,
        totalPages,
    };
};
