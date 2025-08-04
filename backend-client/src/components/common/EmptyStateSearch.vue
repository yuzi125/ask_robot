<script setup>
import emptyStatusNoResults from "@/assets/no_results.png";
</script>

<template>
    <v-empty-state :image="emptyStatusNoResults" title="找不到符合的資料">
        <template v-slot:text>
            <div class="text-medium-emphasis text-caption">試著調整您的搜尋條件</div>

            <div class="text-medium-emphasis text-caption">
                有時候使用較少特定的關鍵字或較廣泛的查詢能幫助您找到想要的結果
            </div>
        </template>
    </v-empty-state>
</template>
