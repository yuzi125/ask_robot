// Vuetify
import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import { createVuetify } from "vuetify";
import { fa } from "vuetify/iconsets/fa";
import { aliases, mdi } from "vuetify/iconsets/mdi";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
// import { VDataTable } from "vuetify/labs/VDataTable";

const myCustomLightTheme = {
    colors: {
        primary: "#1c64f1",
    },
};

export default createVuetify({
    components,
    directives,
    theme: {
        defaultTheme: "myCustomLightTheme",
        themes: {
            myCustomLightTheme,
        },
    },
    icons: {
        defaultSet: "mdi",
        aliases,
        sets: {
            fa,
            mdi,
        },
    },
    aliases: {
        VBtnIcon: components.VBtn,
    },
    defaults: {
        global: {
            ripple: false,
        },
        VBtnIcon: {
            variant: "plain",
        },
    },
});
