<script setup>
import { ref, defineEmits, defineExpose, watch, reactive, computed } from 'vue';
import SelectPanelFile from "@/components/datasets/SelectPanelFile.vue";
const downloadHost = import.meta.env.VITE_BACKEND_HOST + "/download/"

const props = defineProps({
    title: String,
    placeholder: String,
    data: Object,
    datasets_id: String,
    documents: Object,
    documentError: Object,
    isLoadingDocuments: Boolean,
    refetchDocuments: Function,
});

const emit = defineEmits(['confirmSelection']);

const confirmSelection = () => {
    const selected = props.documents.filter(doc => selectedFiles[doc.id]);
    searchQuery.value = '';
    close();
    emit('confirmSelection', selected || []);
};

const handleOverlayClick = () => {
    close();
};

const isOpen = ref(false);
const open = () => {
  isOpen.value = true;
};
const close = () => {
  isOpen.value = false;
};

defineExpose({ open, close });

// 預設選擇全選
const selection = ref('all'); 
const selectedFiles = reactive({});

// 監聽 documents 的變化，當其加載完成後初始化 selectedFiles
watch( () => props.documents, (newDocuments) => {
    if (newDocuments) {
        // 清空現有的 selectedFiles
        for (const key in selectedFiles) {
            delete selectedFiles[key];
        }
        newDocuments.forEach((doc) => {
            selectedFiles[doc.id] = true;
        });
    }
});

// 監聽 selection(radio) 的變化，當其變化時更新 selectedFiles
watch(selection, (newVal) => {
    if (newVal === 'all') {
        if (props.documents) {
            for (const key in selectedFiles) {
                delete selectedFiles[key];
            }
            props.documents.forEach((doc) => {
                selectedFiles[doc.id] = true;
            });
        }
    } else if (newVal === 'skip') {
        for (const key in selectedFiles) {
            delete selectedFiles[key];
        }
    }
});

// 新增搜尋防抖機制與過濾功能，使用 originalname 來篩選文件
const searchQuery = ref('');
const debouncedSearchQuery = ref('');
let debounceTimeout = null;
watch(searchQuery, (newVal) => {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
        debouncedSearchQuery.value = newVal;
    }, 200);
});
const filteredDocuments = computed(() => {
    if (!props.documents) return [];
    if (!debouncedSearchQuery.value) return props.documents;
    // 再根據搜尋條件進行篩選
    return props.documents.filter(doc =>
        doc.originalname.toLowerCase().includes(debouncedSearchQuery.value.toLowerCase())
    );
});
const clearSearch = () => {
    searchQuery.value = '';
};
</script>

<template>
    <transition name="select-panel">
        <div class="overlay" @click="handleOverlayClick" v-if="isOpen">
        <div class="select-panel" @click.stop>
            <div class="select-title">{{ title }}</div>
            <div class="select-sub-title" style="margin-bottom: 0.7rem;">選擇方法:</div>
            
            <div class="radio-group">
                <div class="radio-item">
                    <input type="radio" id="selectAll" value="all" v-model="selection" />
                    <label for="selectAll">全選</label>
                </div>
                <div class="radio-item">
                    <input type="radio" id="custom" value="custom" v-model="selection" />
                    <label for="custom">自訂</label>
                </div>
                <div class="radio-item">
                    <input type="radio" id="skip" value="skip" v-model="selection" />
                    <label for="skip">跳過</label>        
                </div>
            </div>
        
            <div class="select-sub-title-wrapper">
                <div class="select-sub-title">{{ placeholder }}</div>

                <div class="search-box">
                    <v-icon icon="fa:fas fa-search" class="search-icon"></v-icon>    
                    <input type="text" placeholder="搜尋..." class="search-input" v-model="searchQuery" />
                    <span @click="clearSearch" v-if="searchQuery" tabindex="-1">
                        <v-icon icon="fa:fas fa-times" class="clear-icon"></v-icon>
                    </span>
                </div>
            </div>
            <div class="custom-file" @click="selection = 'custom'">
                <ul>
                    <li v-for="item in filteredDocuments" :key="item.id" class="custom-file-li">
                        <SelectPanelFile
                            :fileInfo="item"
                            :downloadHost="downloadHost"
                            :modelValue="selectedFiles[item.id] || false"
                            @update:modelValue="(val) => { selectedFiles[item.id] = val; }"
                        ></SelectPanelFile>
                    </li>
                </ul>
            </div>

            <div class="button-group">
                <v-btn class="btn-yes" color="blue-darken-4" @click="confirmSelection">確定</v-btn>
                <v-btn class="btn-no" @click="close">取消</v-btn>
            </div>
        </div>
        </div>
    </transition>
</template>

<style lang="scss" scoped>
.select-panel-enter-from {
    opacity: 0;
}

.select-panel-enter-active {
    transition: opacity 0.3s;
}

.select-panel-enter-to {
    opacity: 1;
}

.select-panel-leave-from {
    opacity: 1;
}

.select-panel-leave-active {
    transition: opacity 0.3s;
}

.select-panel-leave-to {
    opacity: 0;
}

.overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    justify-content: center;
    align-items: center;
    display: flex;
    background-color: rgba($color: gray, $alpha: 0.5);
    z-index: 999;
}

.select-panel {
    background-color: white;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    padding: 1.6rem;
    padding-right: 1.8rem;
    padding-left: 1.8rem;
    padding-bottom: 1.2rem;
    border-radius: 8px;
    width: 70%;
    max-width: 650px;
    max-height: 90%;
    overflow-y: auto;
}

.select-title {
    font-size: 1.55rem;
    font-weight: bold;
    margin-bottom: 1.2rem;
}

.select-sub-title-wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.7rem;
}

.select-sub-title {
    font-size: 1rem;
    color: gray;
}

.search-box {
    display: flex;
    align-items: center;
    padding: 0.2rem 0.5rem;
    padding-left: 0;
    width: 28%;
    border: 1px solid #ccc;
    border-radius: 4px;    
}

.search-icon {
    margin-left: 0.6rem;
    font-size: 0.9rem;
    color: #888;
    top: -0.07rem;
}

.clear-icon {
    cursor: pointer;
    margin-left: 0.5rem;
    font-size: 1rem;
    color: #888;
}

.search-input {
    outline: none;
    font-size: 1rem;
    width: 100%;
    padding: 0.3rem 0.5rem;
}

.radio-group {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1.3rem;
}

.radio-item {
    display: flex;
    gap: 0.2rem;
}

.custom-file {
    padding: 1rem;
    background-color: #f0f0f0;
    overflow-y: auto;
    min-height: 370px;
    max-height: 370px;
}

.custom-file ul {
    display: flex;
    flex-wrap: wrap;
    padding: 0;
    list-style-type: none;
}

.custom-file-li {
    gap: 0.5rem;
    padding: 0.3rem;
    width:50%;
    // width: calc(33.33% - 1rem);
}

.button-group {
    display: flex;
    justify-content: flex-end;
    margin-top: 1rem;
    margin-right: 0.8rem;
    gap: 0.7rem;
}

.btn-yes {
    background-color: #1c64f2;
    color: white;
}

.btn-no {
    background-color: white;
    color: gray;
    border: 1px solid #cccccc;
}
</style>
