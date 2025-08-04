import axios from "axios";
import { getRedirectUrl } from "@/utils/common";
const host = import.meta.env.VITE_BACKEND_HOST;
// import config from "/config.js";
// const host = config.apiUrl;
// const redirectText = /<title>SSO<\/title>/;
// if (redirectText.test(rs.data)) {
//     window.location.href = rs.request.responseURL;
// }
// maxRedirects: 0,
// validateStatus: (status) => {
//     console.log(status);
// },

export default {
    get: async (api, config) => {
        try {
            var rs = await axios.get(
                host + api,
                config || {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            return rs;
        } catch (e) {
            console.log("e.response.data.SSO_TYPE", e.response.data.SSO_TYPE, e.response.status);
            if (e.response.status == 401 && e.response?.data?.SSO_TYPE?.toLowerCase() === "kcg") {
                window.location.href = e.response.data.Location;
            } else if (e.response.status == 401) {
                const url = getRedirectUrl();
                window.location.href = url;
            }
        }
    },
    post: async (api, data, config) => {
        try {
            var rs = await axios.post(
                host + api,
                data,
                config || {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            return rs;
        } catch (e) {
            console.log("e.response.data.SSO_TYPE", e.response.data.SSO_TYPE, e.response.status);
            if (e.response.status == 401 && e.response?.data?.SSO_TYPE?.toLowerCase() === "kcg") {
                window.location.href = e.response.data.Location;
            } else if (e.response.status == 401) {
                const url = getRedirectUrl();
                window.location.href = url;
            }
        }
    },
    put: async (api, data, config) => {
        try {
            var rs = await axios.put(
                host + api,
                data,
                config || {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            return rs;
        } catch (e) {
            if (e.response.status == 401 && e.response?.data?.SSO_TYPE?.toLowerCase() === "kcg") {
                window.location.href = e.response.data.Location;
            } else if (e.response.status == 401) {
                const url = getRedirectUrl();
                window.location.href = url;
            }
        }
    },
    delete: async (api, config) => {
        try {
            var rs = await axios.delete(
                host + api,
                config || {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            return rs;
        } catch (e) {
            if (e.response.status == 401 && e.response?.data?.SSO_TYPE?.toLowerCase() === "kcg") {
                window.location.href = e.response.data.Location;
            } else if (e.response.status == 401) {
                const url = getRedirectUrl();
                window.location.href = url;
            }
        }
    },
};
