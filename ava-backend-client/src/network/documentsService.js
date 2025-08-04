import axios from "@/global/axios";

export const documentsService = {
    getDocuments: async (datasets_id) => {
        try {
            const response = await axios.get(`/datasets/${datasets_id.value}/documents`);
            if (response.data.code === 0) {
                return response.data.data;
            } else {
                throw new Error("Error fetching documents code");
            }
        } catch (error) {
            console.error("Error fetching documents:", error);
            throw error;
        }
    },
};

