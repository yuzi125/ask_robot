import axios from "axios";
import router from "../router";
import { storeToRefs } from "pinia";
import { useStateStore, useUserStore, useSystemStore } from "../store";

import { useToast } from "@/components/ui/toast";
const { toast } = useToast();

const host = import.meta.env.VITE_CHAT_BACKEND_HOST;
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

const isIframe = window !== window.parent;
// const isIframe = true;

// if (window.parent === window) {
//     emitter.emit("iframeData", null);
// } else {
//     window.parent.postMessage({ type: "reqHtml" }, "*"); // "*"之後有需要指定來源
// }

const handleError = (err) => {
    if (err && err.response && err.response.status) {
        if (err.response.status == 401) {
            if (err.response.data && err.response.data.Location) {
                // 如果是要透過KSG登入，那就不用跳轉到SSO登入。
                const isKSGLogin = router.currentRoute.value.path.includes("KSG-login");
                if (!isKSGLogin) {
                    window.location.href = err.response.data.Location;
                }
            } else {
                if (err.response.data?.isIframe) {
                    window.parent.postMessage({ type: "sessionExpired" }, "*");
                    console.log("isIframe");
                }
            }
        } else if (err.response.status == 503) {
            // 503 = 資料庫連線異常。
            const stateStore = useStateStore();
            const { db_error } = storeToRefs(stateStore);
            db_error.value = err.response.status === 503;
            if (db_error.value) {
                console.log("axios db_error route to maintenance", db_error.value);
                router.push("/maintenance");
            }
        } else if (err.response.status == 403) {
            // 403 = 無權限，導航到登入頁面。
            router.push("/KSG-login");
        } else if (err.response.status == 430) {
            // 430 = 被Ban
            const systemStore = useSystemStore();
            const { restrictionTime } = storeToRefs(systemStore);

            restrictionTime.value = err.response.data?.expiredTime || null;

            router.push("/restricted");
        }
    }
};

// 檢查是否需要二次驗證方法
const needTwoFactorAuth = (response) => {
    try {
        if (response.data.data.twoFactorAuth) {
            // 暫存 userInfo
            const userStore = useUserStore();
            const { tempUser } = storeToRefs(userStore);
            tempUser.value = response.data.data.userInfo;

            toast({
                title: "您的帳號需二次驗證。",
                description: "",
                variant: "success",
            });

            router.push("/two-factor-authentication");

            return true;
        } else {
            return false;
        }
    } catch (error) {
        return false;
    }
};

function setCookie(name, value, seconds) {
    const expires = new Date(Date.now() + seconds * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

export default {
    get: async (api, config) => {
        try {
            var rs = await axios.get(host + api, {
                ...config,
                headers: {
                    ...config?.headers,
                    "Content-Type": "application/json",
                    isIframe: isIframe.toString(),
                },
            });
            // 檢查是否需要二次驗證
            if (needTwoFactorAuth(rs)) {
                return;
            }

            return rs;
        } catch (e) {
            handleError(e);
        }
    },
    post: async (api, data, config) => {
        try {
            var rs = await axios.post(host + api, data, {
                ...config,
                headers: {
                    ...config?.headers,
                    "Content-Type": "application/json",
                    isIframe: isIframe.toString(),
                },
            });
            // 檢查是否需要二次驗證
            if (needTwoFactorAuth(rs)) {
                return;
            }
            return rs;
        } catch (e) {
            handleError(e);
        }
    },
    put: async (api, data, config) => {
        try {
            var rs = await axios.put(host + api, data, {
                ...config,
                headers: {
                    ...config?.headers,
                    "Content-Type": "application/json",
                    isIframe: isIframe.toString(),
                },
            });
            // 檢查是否需要二次驗證
            if (needTwoFactorAuth(rs)) {
                return;
            }
            return rs;
        } catch (e) {
            handleError(e);
        }
    },
    delete: async (api, data, config) => {
        try {
            var rs = await axios.delete(host + api, data, {
                ...config,
                headers: {
                    ...config?.headers,
                    "Content-Type": "application/json",
                    isIframe: isIframe.toString(),
                },
            });
            // 檢查是否需要二次驗證
            if (needTwoFactorAuth(rs)) {
                return;
            }
            return rs;
        } catch (e) {
            handleError(e);
        }
    },
};
