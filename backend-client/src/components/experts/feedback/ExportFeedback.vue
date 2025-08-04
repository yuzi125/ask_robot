<script setup>
import { ref } from "vue";
import dayjs from "dayjs";
import { exportFeedback, getGoogleSheetsLink } from "@/network/service";

const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
const startDate = ref(yesterday);
const endDate = ref(yesterday);
const isLoading = ref(false);

const getFeedback = async () => {
    if (!startDate.value || !endDate.value) {
        alert("請輸入日期");
        return;
    }
    isLoading.value = true;
    try {
        const result = await exportFeedback({
            startDate: startDate.value,
            endDate: endDate.value,
        });
        // 資料放在result.data.data.resultMap內
        const data = result.data.data.resultMap;
        const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `classify_feedback_${startDate.value}_${endDate.value}.json`;
        a.click();
    } catch (error) {
        alert("Making JSON file error.");
    } finally {
        isLoading.value = false;
    }
};

const googleSheetsLink = ref(null);
const getExcelLink = async () => {
    if (googleSheetsLink.value) return;
    const result = await getGoogleSheetsLink();
    if (result.data && result.data.code === 0) {
        googleSheetsLink.value = result.data.data;
    }
};

getExcelLink();
</script>

<template>
    <div class="container">
        <div class="export-card">
            <div class="mb-6">
                <h2 class="title">專家評價匯出</h2>
                <p class="subtitle">請選擇要匯出的日期範圍</p>
            </div>

            <div class="date-section">
                <div class="date-inputs">
                    <div class="date-search-box">
                        <v-text-field
                            type="date"
                            label="開始日期"
                            v-model="startDate"
                            min="2024-07-01"
                            :max="endDate"
                            hide-details
                            variant="outlined"
                            density="comfortable"
                            class="date-field"
                            onkeydown="return false;"
                        />
                    </div>
                    <div class="date-search-box">
                        <v-text-field
                            type="date"
                            label="結束日期"
                            v-model="endDate"
                            :min="startDate"
                            :max="dayjs().format('YYYY-MM-DD')"
                            hide-details
                            variant="outlined"
                            density="comfortable"
                            class="date-field"
                            onkeydown="return false;"
                        />
                    </div>
                </div>
                <v-btn
                    color="primary"
                    @click="getFeedback"
                    :loading="isLoading"
                    :disabled="isLoading"
                    size="large"
                    class="download-btn"
                >
                    <template v-slot:loader>
                        <v-progress-circular indeterminate></v-progress-circular>
                    </template>
                    <v-icon start>mdi-download</v-icon>
                    下載評價資訊
                </v-btn>
            </div>

            <v-divider class="my-8" />

            <div class="sheets-section">
                <h3 class="section-title">Google Sheets 試算表連結</h3>
                <div class="sheets-content">
                    <a v-if="googleSheetsLink" class="google-sheets-link" :href="googleSheetsLink" target="_blank">
                        <v-icon start>mdi-google-sheets</v-icon>
                        {{ googleSheetsLink }}
                    </a>
                    <p v-else class="no-link">查無相關連結</p>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.container {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
}

.export-card {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    height: 100%;
    display: flex;
    flex-direction: column;
}

.title {
    font-size: 1.75rem;
    font-weight: 600;
    color: #1a237e;
    margin-bottom: 0.5rem;
}

.subtitle {
    color: #666;
    font-size: 1rem;
}

.date-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.date-inputs {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
}

.date-search-box {
    flex: 1;
    min-width: 200px;
}

.date-field {
    background: #f5f5f5;
    border-radius: 8px;
}

.download-btn {
    align-self: flex-start;
    padding: 0 2rem;
}

.sheets-section {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 1.5rem;
}

.section-title {
    font-size: 1.25rem;
    font-weight: 500;
    color: #1a237e;
    margin-bottom: 1rem;
}

.sheets-content {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.google-sheets-link {
    color: #1a73e8;
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: white;
    border-radius: 6px;
    transition: all 0.2s ease;
    word-break: break-all;
    max-width: 100%;

    &:hover {
        background: #e8f0fe;
        color: #1557b0;
    }
}

.no-link {
    color: #666;
    font-style: italic;
}

@media (max-width: 600px) {
    .container {
        padding: 0;
    }

    .export-card {
        padding: 1.5rem;
        border-radius: 0;
    }

    .date-inputs {
        flex-direction: column;
    }

    .date-search-box {
        width: 100%;
    }

    .sheets-content {
        flex-direction: column;
        align-items: stretch;
    }

    .google-sheets-link {
        width: 100%;
        justify-content: flex-start;
    }
}
</style>
