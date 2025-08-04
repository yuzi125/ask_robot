import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";

// API 函數
const fetchThemes = async (axios) => {
    try {
        const response = await axios.get("/system/getChatTheme");
        if (response.data.code === 0) {
            return response.data.data;
        }
        throw new Error(response.data.message);
    } catch (error) {
        console.error("Error fetching themes:", error);
        throw error;
    }
};

const fetchLockTheme = async (axios) => {
    try {
        const response = await axios.get("/system/getLockTheme");
        if (response.data.code === 0) {
            return response.data.data;
        }
        throw new Error(response.data.message);
    } catch (error) {
        console.error("Error fetching lock theme:", error);
        throw error;
    }
};

const createTheme = async (axios, themeData) => {
    try {
        const response = await axios.post("/system/createChatTheme", themeData);
        if (response.data.code === 0) {
            return response.data.data;
        }
        throw new Error(response.data.message);
    } catch (error) {
        console.error("Error creating theme:", error);
        throw error;
    }
};

export function useTheme(axios) {
    const queryClient = useQueryClient();

    // 查詢主題列表
    const {
        data: themes,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ["themes"],
        queryFn: () => fetchThemes(axios),
    });

    // 查詢主題鎖定狀態
    const { data: lockTheme, refetch: refetchLockTheme } = useQuery({
        queryKey: ["lockTheme"],
        queryFn: () => fetchLockTheme(axios),
    });

    // 創建主題的 mutation
    const createThemeMutation = useMutation({
        mutationFn: (themeData) => createTheme(axios, themeData),
        onSuccess: () => {
            // 創建成功後重新獲取主題列表
            queryClient.invalidateQueries(["themes"]);
        },
    });

    return {
        themes,
        isLoading,
        refetch,
        error,
        createThemeMutation,
        lockTheme,
        refetchLockTheme,
    };
}
