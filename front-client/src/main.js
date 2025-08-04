import { createApp } from "vue";
import "./style.css";
import "./md.css";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import "@fortawesome/fontawesome-free/css/all.css";
import "@fortawesome/fontawesome-free/js/all.js";
import TooltipComponent from "./components/TooltipComponent.vue";
import VueDOMPurifyHTML from "vue-dompurify-html";
import { VueQueryPlugin } from "@tanstack/vue-query";

document.title = import.meta.env.APP_TITLE;

const app = createApp(App);

app.use(VueQueryPlugin);
app.use(createPinia());
app.use(router);
app.use(VueDOMPurifyHTML, {
    hooks: {
        afterSanitizeAttributes: (currentNode) => {
            if (currentNode.tagName && currentNode.tagName.toLowerCase() === "a") {
                currentNode.setAttribute("target", "_aboutblank");
            }
        },
    },
});
app.component("v-tooltip", TooltipComponent);
app.mount("#app");
