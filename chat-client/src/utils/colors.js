// 主題相關常量
const THEME_CONSTANTS = {
    DEFAULT_THEME_COLOR: "#6576db",
    DEFAULT_SELECT_COLOR: "#475569",
    THEME_COLOR_OPACITY: {
        LIGHT: 0.2,
        MEDIUM: 0.3,
    },
    STORAGE_KEY: "preferred-theme",
    BASE_RGB: [101, 118, 219], // RGB values for theme color
};

// 計算顏色的亮度值
export function getLuminance(color) {
    // 處理十六進制顏色碼
    if (color.startsWith("#")) {
        color = color.substring(1);
        // 處理縮寫形式 (#fff => #ffffff)
        if (color.length === 3) {
            color = color
                .split("")
                .map((char) => char + char)
                .join("");
        }
    }

    // 將顏色轉換為 RGB 值
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);

    // 使用 YIQ 公式計算亮度
    // YIQ = (R * 299 + G * 587 + B * 114) / 1000
    return (r * 299 + g * 587 + b * 114) / 1000;
}

// 判斷應該使用的文字顏色（黑色或白色）
export function getContrastTextColor(backgroundColor) {
    const luminance = getLuminance(backgroundColor);
    // 亮度閾值為 128，大於此值使用黑色文字，小於則使用白色文字
    return luminance > 128 ? "#000000" : "#ffffff";
}

// 生成帶透明度的顏色變體
function generateColorVariants(baseRgb = THEME_CONSTANTS.BASE_RGB) {
    const [r, g, b] = baseRgb;
    return {
        base: THEME_CONSTANTS.DEFAULT_THEME_COLOR,
        alpha20: `rgba(${r}, ${g}, ${b}, ${THEME_CONSTANTS.THEME_COLOR_OPACITY.LIGHT})`,
        alpha30: `rgba(${r}, ${g}, ${b}, ${THEME_CONSTANTS.THEME_COLOR_OPACITY.MEDIUM})`,
    };
}

// 組織 CSS 變數
export function generateCSSVariables(themeColors) {
    // 計算對比文字顏色
    const textColors = {
        primary: getContrastTextColor(themeColors.base.primary),
        chat: getContrastTextColor(themeColors.chatArea.bg),
        navigation: themeColors.navigation.text,
        navbar: themeColors.topBar.text,
        input: themeColors.inputArea.text,
    };

    const colorVariants = generateColorVariants();

    return {
        backgrounds: {
            "--navbar-bg-color": themeColors.topBar.bg,
            "--navigation-bg-color": themeColors.navigation.bg,
            "--chat-bg-color": themeColors.chatArea.bg,
            "--input-bg-color": themeColors.inputArea.bg,
            "--chatbox-user-bg-color": themeColors.chatArea.userBg,
            "--chatbox-robot-bg-color": themeColors.chatArea.robotBg,
            "--chatbox-robot-btn-bg-color": themeColors.chatArea.robotBtn,
            "--chatbox-robot-long-btn-bg-color": themeColors.chatArea.robotLongBtn,
        },
        texts: {
            "--navigation-text-color": textColors.navigation,
            "--navbar-text-color": textColors.navbar,
            "--chat-text-color": textColors.chat,
            "--text-color": textColors.primary,
            "--input-text-color": textColors.input,
            "--chatbox-user-text-color": themeColors.chatArea.userText,
            "--chatbox-robot-text-color": themeColors.chatArea.robotText,
            "--chatbox-robot-btn-text-color": themeColors.chatArea.robotBtnText,
            "--chatbox-robot-long-btn-text-color": themeColors.chatArea.robotLongBtnText,
        },
        baseColors: {
            "--primary-color": themeColors.base.primary,
            "--secondary-color": themeColors.base.secondary,
            "--tertiary-color": themeColors.base.tertiary,
            "--select-color": THEME_CONSTANTS.DEFAULT_SELECT_COLOR,
            "--room-list-active": themeColors.navigation.roomActiveBg,
        },
        themeVariants: {
            "--theme-color": colorVariants.base,
            "--theme-color-20": colorVariants.alpha20,
            "--theme-color-30": colorVariants.alpha30,
        },
    };
}

// 將物件轉換為 CSS 字符串
export function convertToCSSString(cssVariables) {
    return Object.entries(cssVariables)
        .map(([_, vars]) =>
            Object.entries(vars)
                .map(([key, value]) => `    ${key}: ${value};`)
                .join("\n")
        )
        .join("\n");
}
