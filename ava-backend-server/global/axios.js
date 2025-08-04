const axios = require("axios");

module.exports = {
    get: async (api, config) => {
        try {
            var rs = await axios.get(
                api,
                config || {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            return rs;
        } catch (e) {
            console.log(e);

        }
    },
    post: async (api, data, config) => {
        try {
            var rs = await axios.post(
                api,
                data,
                config || {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            return rs;
        } catch (e) {
            console.log(e);
        }
    },
    put: async (api, data, config) => {
        try {
            var rs = await axios.put(
                api,
                data,
                config || {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            return rs;
        } catch (e) {
            console.log(e);

        }
    },
    delete: async (api, config) => {
        try {
            var rs = await axios.delete(
                api,
                config || {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            return rs;
        } catch (e) {
            console.log(e);

        }
    },
};
