import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/vue-query";
import {
    fetchAllGroups,
    fetchGroupById,
    createGroup,
    updateGroup,
    deleteGroup,
    fetchUsers,
    addUserToGroup,
    removeUserFromGroup,
} from "@/network/permission";
import { inject, ref, computed } from "vue";

// 獲取群組和使用者數據與操作
export function useGroupPermission() {
    const queryClient = useQueryClient();
    const emitter = inject("emitter");

    // 群組搜尋參數
    const groupParams = ref({
        page: 1,
        pageSize: 10,
        search: "",
    });

    // 更新群組搜尋參數的方法
    const updateGroupParams = (params) => {
        groupParams.value = { ...groupParams.value, ...params };
    };

    // 獲取所有群組
    const {
        data: groupsData,
        isLoading: isLoadingGroups,
        isError: groupsError,
        error: groupsErrorMessage,
        refetch: refetchGroups,
        isPlaceholderData: isGroupsPlaceholderData,
    } = useQuery({
        queryKey: ["groups", groupParams],
        queryFn: () => fetchAllGroups(groupParams.value),
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
    });
    // 獲取單一群組
    const getGroup = (groupId) => {
        return useQuery({
            queryKey: ["group", groupId],
            queryFn: () => fetchGroupById(groupId),
            staleTime: 1000 * 60 * 5,
            enabled: !!groupId, // 只有當 groupId 存在時才發送請求
        });
    };

    // 搜尋參數
    const searchParams = ref({
        page: 1,
        pageSize: 10,
        search: "",
    });

    // 更新搜尋參數的方法
    const updateSearchParams = (params) => {
        searchParams.value = { ...searchParams.value, ...params };
    };

    // 獲取使用者清單 - 改為直接使用 useQuery
    const {
        data: usersData,
        isLoading: isLoadingUsers,
        isError: usersError,
        error: usersErrorMessage,
        refetch: refetchUsers,
        isPlaceholderData: isUsersPlaceholderData,
    } = useQuery({
        queryKey: ["users", searchParams],
        queryFn: () => fetchUsers(searchParams.value),
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
    });

    // 創建群組
    const { mutateAsync: createGroupAsync, isPending: creating } = useMutation({
        mutationFn: createGroup,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["groups"] });
            emitter?.emit("openSnackbar", { message: "群組創建成功", color: "success" });
        },
        onError: (error) => {
            emitter?.emit("openSnackbar", { message: error.message || "群組創建失敗", color: "error" });
        },
    });

    // 更新群組
    const { mutateAsync: updateGroupAsync, isPending: updating } = useMutation({
        mutationFn: updateGroup,
        onSuccess: async (data) => {
            await queryClient.invalidateQueries({ queryKey: ["group", data.groupId] });
            await queryClient.invalidateQueries({ queryKey: ["groups"] });
            emitter?.emit("openSnackbar", { message: "群組更新成功", color: "success" });
        },
        onError: (error) => {
            emitter?.emit("openSnackbar", { message: error.message || "群組更新失敗", color: "error" });
        },
    });

    // 刪除群組
    const { mutateAsync: deleteGroupAsync, isPending: deleting } = useMutation({
        mutationFn: deleteGroup,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["groups"] });
            emitter?.emit("openSnackbar", { message: "群組刪除成功", color: "success" });
        },
        onError: (error) => {
            emitter?.emit("openSnackbar", { message: error.message || "群組刪除失敗", color: "error" });
        },
    });

    // 新增使用者至群組
    const { mutateAsync: addUserToGroupAsync, isPending: addingUser } = useMutation({
        mutationFn: addUserToGroup,
        onSuccess: async (data) => {
            await queryClient.invalidateQueries({ queryKey: ["group", data.groupId] });
            await queryClient.invalidateQueries({ queryKey: ["groups"] });
            emitter?.emit("openSnackbar", { message: "使用者已成功新增至群組", color: "success" });
        },
        onError: (error) => {
            emitter?.emit("openSnackbar", { message: error.message || "新增使用者至群組失敗", color: "error" });
        },
    });

    // 從群組移除使用者
    const { mutateAsync: removeUserFromGroupAsync, isPending: removingUser } = useMutation({
        mutationFn: removeUserFromGroup,
        onSuccess: async (data) => {
            await queryClient.invalidateQueries({ queryKey: ["group", data.groupId] });
            await queryClient.invalidateQueries({ queryKey: ["groups"] });
            emitter?.emit("openSnackbar", { message: "使用者已成功從群組移除", color: "success" });
        },
        onError: (error) => {
            emitter?.emit("openSnackbar", { message: error.message || "從群組移除使用者失敗", color: "error" });
        },
    });

    return {
        // 查詢數據
        groupsData,
        isLoadingGroups,
        groupsError,
        groupsErrorMessage,
        refetchGroups,
        getGroup,
        groupParams,
        updateGroupParams,

        // 使用者查詢
        usersData,
        isLoadingUsers,
        usersError,
        usersErrorMessage,
        refetchUsers,
        searchParams,
        updateSearchParams,

        // 變更操作
        createGroupAsync,
        updateGroupAsync,
        deleteGroupAsync,
        addUserToGroupAsync,
        removeUserFromGroupAsync,

        // 狀態
        creating,
        updating,
        deleting,
        addingUser,
        removingUser,
        isGroupsPlaceholderData,
        isUsersPlaceholderData,
    };
}
