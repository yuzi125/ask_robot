import axios from "@/global/axios";

export const apiKeyService = {
    getAPIKeys: async () => {
        try {
            const response = await axios.get("/system/getAPIKeys");
            return response.data.data;
        } catch (error) {
            console.error("Error fetching API keys:", error);
            throw error;
        }
    },

    createAPIKey: async (data) => {
        try {
            const response = await axios.post("/system/createAPIKey", {
                userId: data.userId,
                domains: data.domains,
                paths: data.paths,
                description: data.description,
            });

            if (response.data.code === 1) {
                throw new Error(response.data.message);
            }
            return response.data.data;
        } catch (error) {
            console.error("Error creating API key:", error);
            throw error;
        }
    },

    updateDomains: async ({ keyId, domain }) => {
        try {
            const response = await axios.put("/system/updateDomains", {
                keyId,
                domain,
            });

            if (response.data.code === 1) {
                throw new Error(response.data.message);
            }
            return response.data.data;
        } catch (error) {
            console.error("Error updating domains:", error);
            throw error;
        }
    },

    updatePaths: async ({ keyId, path }) => {
        try {
            const response = await axios.put("/system/updatePaths", { keyId, path });
            if (response.data.code === 1) {
                throw new Error(response.data.message);
            }
            return response.data.data;
        } catch (error) {
            console.error("Error updating paths:", error);
            throw error;
        }
    },

    updateCommonSettings: async ({ keyId, description }) => {
        try {
            const response = await axios.put("/system/updateCommonSettings", { keyId, description });
            if (response.data.code === 1) {
                throw new Error(response.data.message);
            }
            return response.data.data;
        } catch (error) {
            console.error("Error updating common settings:", error);
            throw error;
        }
    },

    deleteAPIKey: async ({ apiKeyId }) => {
        try {
            const response = await axios.delete(`/system/deleteAPIKey`, {
                data: { apiKeyId },
            });
            if (response.data.code === 1) {
                throw new Error(response.data.message);
            }
            return response.data.data;
        } catch (error) {
            console.error("Error deleting API key:", error);
            throw error;
        }
    },

    deleteDomain: async ({ domainId }) => {
        try {
            const response = await axios.delete(`/system/deleteDomain`, {
                data: { domainId },
            });

            if (response.data.code === 1) {
                throw new Error(response.data.message);
            }
        } catch (error) {
            console.error("Error deleting domain:", error);
            throw error;
        }
    },

    deletePath: async ({ pathId }) => {
        try {
            const response = await axios.delete(`/system/deletePath`, {
                data: { pathId },
            });
            if (response.data.code === 1) {
                throw new Error(response.data.message);
            }
            return response.data.data;
        } catch (error) {
            console.error("Error deleting path:", error);
            throw error;
        }
    },

    toggleDomainStatus: async ({ domainId, status }) => {
        try {
            const response = await axios.put("/system/toggleDomainStatus", {
                domainId,
                status,
            });
            if (response.data.code === 1) {
                throw new Error(response.data.message);
            }
            return response.data.data;
        } catch (error) {
            console.error("Error toggling domain status:", error);
            throw error;
        }
    },

    toggleAPIKeyStatus: async ({ api_key_id, status }) => {
        try {
            const response = await axios.put("/system/toggleAPIKeyStatus", {
                apiKeyId: api_key_id,
                status,
            });
            if (response.data.code === 1) {
                throw new Error(response.data.message);
            }
            return response.data.data;
        } catch (error) {
            console.error("Error toggling API key status:", error);
            throw error;
        }
    },

    togglePathStatus: async ({ pathId, status }) => {
        try {
            const response = await axios.put("/system/togglePathStatus", { pathId, status });
            if (response.data.code === 1) {
                throw new Error(response.data.message);
            }
            return response.data.data;
        } catch (error) {
            console.error("Error toggling path status:", error);
            throw error;
        }
    },
};
