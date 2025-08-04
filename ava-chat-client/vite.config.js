import vue from "@vitejs/plugin-vue";
import path from "path";
import { defineConfig } from "vite";
import VueDevTools from "vite-plugin-vue-devtools";
const api_proxy = {
    // target: "http://127.0.0.1:8081",
    target: "http://127.0.0.1:5001",
    changeOrigin: false,
    secure: false,
};

let chat_proxy = {
    target: "http://127.0.0.1:8081",
    changeOrigin: false,
    secure: false,
};

export default defineConfig(({ mode }) => {
    const isIframe = process.env.VITE_APP_MODE === "kaohsiung-iframe";
    const isKaohsiung = process.env.VITE_APP_MODE === "kaohsiung" || isIframe;

    return {
        plugins: [vue(), VueDevTools()],
        base: isIframe ? "/kaohsiung-iframe/" : isKaohsiung ? "/kaohsiung/" : "/ava/avaClient/",
        define: {
            "process.env.VITE_APP_MODE": JSON.stringify(process.env.VITE_APP_MODE || "default"),
        },
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
        server: {
            host: "0.0.0.0",
            port: isKaohsiung ? 5005 : 5000,
            proxy: {
                "/ava/api": api_proxy,
                "/ava/api/voice": api_proxy,
                "/ava/files": api_proxy,
                "/ava/app": api_proxy,
                "/ava/mgt": api_proxy,
                "/ava/chat": chat_proxy,
                "/ava/s": chat_proxy,
            },
        },
    };
});
