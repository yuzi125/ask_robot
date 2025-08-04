import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { apiKeyService } from "@/network/apiKeyService";
import { userService } from "@/network/userService";
import { inject, ref } from "vue";

export const useAPIKeyData = () => {
    const queryClient = useQueryClient();
    const emitter = inject("emitter");
    const selectedUser = ref(null);
    // 獲取使用者列表
    const {
        data: users,
        isLoading: loadingUsers,
        isError: usersError,
        error: usersErrorMessage,
        refetch: refetchUsers,
    } = useQuery({
        queryKey: ["users"],
        queryFn: userService.getUsers,
        staleTime: 5 * 60 * 1000, // 5分鐘內不重新請求
        cacheTime: 30 * 60 * 1000, // 快取 30 分鐘
    });

    // 獲取 API Keys 列表
    const {
        data: apiKeys,
        isLoading,
        isError,
        error,
        refetch: refetchAPIKeys,
        isFetching: isAPIKeysFetching,
    } = useQuery({
        queryKey: ["apiKeys"],
        refetchInterval: 1000 * 30, // 每 30 秒重新請求一次
        queryFn: apiKeyService.getAPIKeys,
    });

    // 創建 API Key
    const { mutateAsync: createUserAPIKey, isLoading: creating } = useMutation({
        mutationFn: apiKeyService.createAPIKey,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
        },
    });

    // 更新網域
    const { mutateAsync: updateDomains, isLoading: updating } = useMutation({
        mutationFn: apiKeyService.updateDomains,
        onSuccess: async () => {
            // 先重新取得最新數據
            await queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
            await queryClient.fetchQuery({ queryKey: ["apiKeys"] });

            // 然後再更新 selectedUser
            const updatedKeys = queryClient.getQueryData(["apiKeys"]);
            if (updatedKeys && selectedUser.value?.api_key_id) {
                // 使用 api_key_id 而不是 id
                const updatedUser = updatedKeys.find((user) => user.api_key_id === selectedUser.value.api_key_id);
                if (updatedUser) {
                    selectedUser.value = { ...updatedUser };
                }
            }

            emitter.emit("openSnackbar", { message: "更新成功", color: "success" });
        },
        onError: (error) => {
            emitter.emit("openSnackbar", { message: error.message, color: "error" });
        },
    });

    // 更新路徑
    const { mutateAsync: updatePaths, isLoading: updatingPaths } = useMutation({
        mutationFn: apiKeyService.updatePaths,
        onSuccess: async () => {
            // 先重新取得最新數據
            await queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
            await queryClient.fetchQuery({ queryKey: ["apiKeys"] });

            // 然後再更新 selectedUser
            const updatedKeys = queryClient.getQueryData(["apiKeys"]);
            if (updatedKeys && selectedUser.value?.api_key_id) {
                // 使用 api_key_id 而不是 id
                const updatedUser = updatedKeys.find((user) => user.api_key_id === selectedUser.value.api_key_id);
                if (updatedUser) {
                    selectedUser.value = { ...updatedUser };
                }
            }

            emitter.emit("openSnackbar", { message: "更新成功", color: "success" });
        },
        onError: (error) => {
            emitter.emit("openSnackbar", { message: error.message, color: "error" });
        },
    });

    // 刪除 API Key
    const { mutateAsync: deleteUser, isPending: deletingAPIKey } = useMutation({
        mutationFn: apiKeyService.deleteAPIKey,
        onSuccess: (id) => {
            queryClient.invalidateQueries(["apiKeys"]);
        },
    });

    // 刪除 domain
    const { mutateAsync: deleteDomain, isLoading: deletingDomain } = useMutation({
        mutationFn: apiKeyService.deleteDomain,
        onSuccess: async () => {
            // 先重新取得最新數據
            await queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
            await queryClient.fetchQuery({ queryKey: ["apiKeys"] });

            // 然後再更新 selectedUser
            const updatedKeys = queryClient.getQueryData(["apiKeys"]);
            if (updatedKeys && selectedUser.value?.api_key_id) {
                // 使用 api_key_id 而不是 id
                const updatedUser = updatedKeys.find((user) => user.api_key_id === selectedUser.value.api_key_id);
                if (updatedUser) {
                    selectedUser.value = { ...updatedUser };
                }
            }

            emitter.emit("openSnackbar", { message: "更新成功", color: "success" });
        },
        onError: (error) => {
            emitter.emit("openSnackbar", { message: error.message, color: "error" });
        },
    });

    // 刪除 path
    const { mutateAsync: deletePath, isLoading: deletingPath } = useMutation({
        mutationFn: apiKeyService.deletePath,
        onSuccess: async () => {
            // 先重新取得最新數據
            await queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
            await queryClient.fetchQuery({ queryKey: ["apiKeys"] });

            // 然後再更新 selectedUser
            const updatedKeys = queryClient.getQueryData(["apiKeys"]);
            if (updatedKeys && selectedUser.value?.api_key_id) {
                // 使用 api_key_id 而不是 id
                const updatedUser = updatedKeys.find((user) => user.api_key_id === selectedUser.value.api_key_id);
                if (updatedUser) {
                    selectedUser.value = { ...updatedUser };
                }
            }

            emitter.emit("openSnackbar", { message: "更新成功", color: "success" });
        },
        onError: (error) => {
            emitter.emit("openSnackbar", { message: error.message, color: "error" });
        },
    });

    // 啟用/停用 API Key
    const { mutateAsync: toggleStatus, isLoading: toggling } = useMutation({
        mutationFn: apiKeyService.toggleAPIKeyStatus,
        onSuccess: () => {
            queryClient.invalidateQueries(["apiKeys"]);
            emitter.emit("openSnackbar", { message: "更新成功", color: "success" });
        },

        onError: (error) => {
            emitter.emit("openSnackbar", { message: error.message, color: "error" });
        },
    });

    // 切換 domain 狀態
    const { mutateAsync: toggleDomainStatus, isLoading: togglingDomain } = useMutation({
        mutationFn: apiKeyService.toggleDomainStatus,
        onSuccess: async () => {
            // 先重新取得最新數據
            await queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
            await queryClient.fetchQuery({ queryKey: ["apiKeys"] });

            // 然後再更新 selectedUser
            const updatedKeys = queryClient.getQueryData(["apiKeys"]);
            if (updatedKeys && selectedUser.value?.api_key_id) {
                // 使用 api_key_id 而不是 id
                const updatedUser = updatedKeys.find((user) => user.api_key_id === selectedUser.value.api_key_id);
                if (updatedUser) {
                    selectedUser.value = { ...updatedUser };
                }
            }

            emitter.emit("openSnackbar", { message: "更新成功", color: "success" });
        },
        onError: (error) => {
            emitter.emit("openSnackbar", { message: error.message, color: "error" });
        },
    });

    // 切換 path 狀態
    const { mutateAsync: togglePathStatus, isLoading: togglingPath } = useMutation({
        mutationFn: apiKeyService.togglePathStatus,
        onSuccess: async () => {
            // 先重新取得最新數據
            await queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
            await queryClient.fetchQuery({ queryKey: ["apiKeys"] });

            // 然後再更新 selectedUser
            const updatedKeys = queryClient.getQueryData(["apiKeys"]);
            if (updatedKeys && selectedUser.value?.api_key_id) {
                // 使用 api_key_id 而不是 id
                const updatedUser = updatedKeys.find((user) => user.api_key_id === selectedUser.value.api_key_id);
                if (updatedUser) {
                    selectedUser.value = { ...updatedUser };
                }
            }

            emitter.emit("openSnackbar", { message: "更新成功", color: "success" });
        },
        onError: (error) => {
            emitter.emit("openSnackbar", { message: error.message, color: "error" });
        },
    });

    // 更新一般設定
    const { mutateAsync: updateCommonSettings, isLoading: updatingCommonSettings } = useMutation({
        mutationFn: apiKeyService.updateCommonSettings,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
            emitter.emit("openSnackbar", { message: "更新成功", color: "success" });
        },
        onError: (error) => {
            emitter.emit("openSnackbar", { message: error.message, color: "error" });
        },
    });

    return {
        // Users
        users,
        loadingUsers,
        usersError,
        usersErrorMessage,

        // API Keys
        apiKeys,
        isLoading,
        isAPIKeysFetching,
        isError,
        error,
        refetchUsers,
        refetchAPIKeys,

        // Mutations
        createUserAPIKey,
        updateDomains,
        updatePaths,
        updateCommonSettings,
        deleteUser,
        deleteDomain,
        deletePath,
        toggleStatus,
        toggleDomainStatus,
        togglePathStatus,

        // Mutation States
        creating,
        updating,

        // Selected User
        selectedUser,

        // Mutation States
        deletingAPIKey,
    };
};
