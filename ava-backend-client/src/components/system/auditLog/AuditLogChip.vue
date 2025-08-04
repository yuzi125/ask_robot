<script setup>
import { getActionTypeColor, getEntityTypeColor } from "@/utils/auditLogUtils";
import { computed } from "vue";

const props = defineProps({
    // 可以接收操作類型或實體類型
    type: {
        type: String,
        required: true,
    },
    // 顯示文字
    label: {
        type: String,
        required: true,
    },
    // 類型種類 'action' 或 'entity'
    category: {
        type: String,
        default: "action",
        validator: (value) => ["action", "entity"].includes(value),
    },
    // 是否為小尺寸
    small: {
        type: Boolean,
        default: false,
    },
});

// 根據類型和種類獲取顏色
const chipStyle = computed(() => {
    const colorConfig = props.category === "action" ? getActionTypeColor(props.type) : getEntityTypeColor(props.type);

    return {
        backgroundColor: colorConfig.color,
    };
});

// 計算尺寸類別
// const sizeClass = computed(() => (props.small ? "v-chip--size-small" : ""));
</script>

<template>
    <v-chip :color="chipStyle.backgroundColor"> {{ label }} </v-chip>
</template>
