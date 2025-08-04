import { useQueryClient } from "@tanstack/vue-query";
import { computed } from "vue";

export function useQueryStatus(queryKey) {
    const queryClient = useQueryClient();

    const status = computed(() => queryClient.getQueryState(queryKey)?.status);

    const isLoading = computed(() => status.value === "loading");
    const isError = computed(() => status.value === "error");
    const isSuccess = computed(() => status.value === "success");

    return { status, isLoading, isError, isSuccess };
}
