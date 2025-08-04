import vue from "@vitejs/plugin-vue";
import path from "path";
import { defineConfig } from "vite";
import VueDevTools from "vite-plugin-vue-devtools";

export default defineConfig({
    plugins: [vue(), VueDevTools()],
    base: "/ava/back/",
    server: {
        host: "0.0.0.0",
        port: 5002,
        proxy: {
            "/ava/backend": {
                target: "http://127.0.0.1:8082",
                changeOrigin: false,
                secure: false,
            },
            "/ava/chat": {
                target: "http://127.0.0.1:8081",
                changeOrigin: false,
                secure: false,
            },
            "/ava/api": {
                target: "http://127.0.0.1:5001",
                changeOrigin: false,
                secure: false,
            },
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
