import axios from "@/global/axios";

export const inputMessageService = {
    getMinMessageLength: async () => {
        try {
            const response = await axios.get("/bot/getMinMessageLength");
            if (response.data.code === 0) {
                return response.data.data;
            }
            throw new Error(response.data.message);
        } catch (error) {
            console.error("Error fetching min input limit:", error);
            throw error;
        }
    },
};

