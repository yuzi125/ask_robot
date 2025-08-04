import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { documentsService } from "@/network/documentsService";
import { inject, ref, watch, computed } from "vue";

export const useDocuments = (datasets_id, autoUpdata) => {
    const queryClient = useQueryClient();
    const emitter = inject("emitter");

    // 因為要過濾，所以寫了個fetchDocuments
    const fetchDocuments = async () => {
        const responseData = await documentsService.getDocuments(datasets_id);
        const body = responseData.documents.filter((doc) => doc.is_enable === 1);
        return {
            body,
            describe: responseData.describe,
            name: responseData.name,
        };
    };

    const { data, error, isLoading, refetch } = useQuery({
        queryKey: ["documents", datasets_id],
        queryFn: fetchDocuments,
        enabled: computed(() => !!datasets_id.value),
        refetchInterval: computed(() => (autoUpdata.value ? 3000 : false)),
    });

    return { 
        // documents
        data,
        error,
        isLoading,
        refetch,
    };
};
