import axios from "@/global/axios";

export const userService = {
    getUsers: async () => {
        const response = await axios.get("/system/getUsers");
        return response.data.data;
    },
};
