<script setup>
import AnimatedNumber from "@/components/common/AnimatedNumber.vue";
import coinAnimation from "@/assets/lottie/coin.json";
import uploadAnimation from "@/assets/lottie/upload.json";
import spiderAnimation from "@/assets/lottie/spider.json";
import puzzleAnimation from "@/assets/lottie/puzzle.json";

const props = defineProps({
    iconData: Object,
    title: String,
    mainData: Object,
    subData: Object,
    loading: Boolean,
});

const getAnimation = () => {
    if (props.title === "花費") {
        return coinAnimation;
    } else if (props.title === "上傳") {
        return uploadAnimation;
    } else if (props.title === "爬蟲") {
        return spiderAnimation;
    } else if (props.title === "Chunks") {
        return puzzleAnimation;
    }
};

const numberStyle = {
    fontWeight: "bold",
    fontSize: "1.8em",
};
</script>

<template>
    <v-card rounded="lg" height="100%" elevation="3" class="px-5 py-3 mt-2 d-flex align-center">
        <v-row>
            <v-col cols="12" sm="5" md="4" lg="12" xl="3" class="d-flex align-center">
                <p class="mr-2 d-flex align-center">
                    <Vue3Lottie
                        :style="{ width: iconData.size, height: iconData.size }"
                        :animationData="getAnimation()"
                        :loop="false"
                        noMargin
                    />
                    <span class="ml-2 text-no-wrap font-weight-bold text-md-h6">{{ title }}</span>
                </p>
            </v-col>
            <v-col cols="12" sm="7" md="8" lg="12" xl="9">
                <div class="flex-wrap justify-end align-xl-end d-flex flex-md-column ga-1">
                    <div class="w-100" v-if="loading">
                        <v-skeleton-loader type="paragraph" height="70"></v-skeleton-loader>
                    </div>
                    <div v-else>
                        <p class="number-wrap">
                            <AnimatedNumber :number="mainData.value" :style="numberStyle" />
                            <span class="unit">{{ mainData.unit }}</span>
                        </p>
                        <p v-if="subData" class="number-wrap">
                            <AnimatedNumber :number="subData.value" :style="numberStyle" />
                            <span class="unit">{{ subData.unit }}</span>
                        </p>
                        <p v-else class="number-wrap" style="opacity: 0">
                            <AnimatedNumber :number="null" :style="numberStyle" />
                            <span class="unit"></span>
                        </p>
                    </div>
                </div>
            </v-col>
        </v-row>
    </v-card>
</template>

<style scoped lang="scss">
.number-wrap {
    display: flex;
    justify-content: end;
    align-items: end;
    flex-wrap: wrap;
}

.unit {
    width: 55px;
    color: #9e9e9e;
    margin-left: 4px;
    text-align: end;
}
</style>
