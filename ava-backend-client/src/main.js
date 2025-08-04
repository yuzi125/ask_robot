import { createApp } from "vue";
import "./style.css";
import "./md.css";
import App from "./App.vue";
import router from "./router";
import { createPinia } from "pinia";
// import VueApexCharts from "vue3-apexcharts";
import "@fortawesome/fontawesome-free/css/all.css";
import "@fortawesome/fontawesome-free/js/all.js";
import VueDOMPurifyHTML from "vue-dompurify-html";
import Vue3Lottie from "vue3-lottie";

import vuetify from "./plugins/vuetify";

import { VueQueryPlugin } from "@tanstack/vue-query";
document.title = import.meta.env.APP_TITLE;

const app = createApp(App);
// app.use(VueApexCharts);
app.use(router);
app.use(vuetify);
app.use(createPinia());
app.use(VueDOMPurifyHTML);
app.use(VueQueryPlugin);
app.use(Vue3Lottie);
app.mount("#app");
