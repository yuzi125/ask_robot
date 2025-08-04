<script setup>
import { ref, computed, onMounted, inject, watch } from 'vue'
import SystemHeader from '@/components/system/SystemHeader.vue'
import { useLocalStorage } from "@vueuse/core";

const axios = inject('axios')
const emitter = inject('emitter')

// 響應式數據
const loading = ref(false)
const saving = ref(false)
const models = ref([])
const searchQuery = ref('')
const filterType = ref(null)
const filterVendor = ref(null)
const filterStatus = ref(null)
const page = ref(1)
const itemsPerPage = ref(10)

// 編輯對話框相關
const editDialog = ref(false)
const editFormValid = ref(false)
const editForm = ref(null)
const activeTab = ref("basic-info")
const editedModel = ref({
  id: null,
  name: '',
  vendor: '',
  model_name: '',
  model_type: '',
  is_enable: 1,
  config: {
    top_p: 1,
    max_tokens: 1200,
    temperature: 0,
    system_prompt: '',
    frequency_penalty: 0
  }
})

// 修正表格標頭配置，使其與實際資料欄位對應
const header = ref([
    { title: "名稱", key: "name", sortable: true, sort: { field: "name", orderBy: "asc" } },
    { title: "供應商", key: "vendor", sortable: true, sort: { field: "vendor", orderBy: "asc" } },
    { title: "模型名稱", key: "model_name", sortable: true, sort: { field: "model_name", orderBy: "asc" } },
    { title: "模型類別", key: "model_type", sortable: true, sort: { field: "model_type", orderBy: "asc" } },
    { title: "啟用", key: "is_enable", sortable: false }
]);

// 表格資料
const tableData = ref({
  header: header.value,
  body: []
});

const visibleColumns = useLocalStorage(
    "showModelTableColumn",
    tableData.value.header.map((_, index) => index)
);

// 分頁選項
const options = ref([
    { title: "10", value: 10 },
    { title: "25", value: 25 },
    { title: "50", value: 50 },
    { title: "100", value: 100 },
]);

// 排序相關
const currentSort = ref({ field: null, orderBy: null });

// 篩選選項
const typeOptions = computed(() => {
  const types = [...new Set(tableData.value.body.map(m => m.model_type))].filter(Boolean)
  return types.map(type => ({
    title: getModelTypeLabel(type),
    value: type
  }))
})

const vendorOptions = computed(() => {
  const vendors = [...new Set(tableData.value.body.map(m => m.vendor))].filter(Boolean)
  return vendors.map(vendor => ({
    title: vendor,
    value: vendor
  }))
})

const statusOptions = [
  { title: '全部', value: null },
  { title: '啟用', value: 1 },
  { title: '停用', value: 0 }
]
const modellabel = [
  {title:"潤飾模組", value:"search"},
  {title:"語意模組", value:"intention"},
  {title:"意圖模組", value:"kor"},
  {title:"embedding模組", value:"embedding"},
  {title:"語音模組", value:"voice"},
]

// 根據模型類別值獲取對應的顯示標籤
const getModelTypeLabel = (modelType) => {
  const labelItem = modellabel.find(item => item.value === modelType)
  return labelItem ? labelItem.title : modelType
}

// 編輯對話框的模型類別選項 (與篩選選項共用同一個計算屬性)
const allTypeOptions = computed(() => typeOptions.value)

// 過濾後的模型列表
const filteredModels = computed(() => {
  let filtered = tableData.value.body

  // 搜尋過濾
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(m => 
      m.name.toLowerCase().includes(query) ||
      m.vendor.toLowerCase().includes(query) ||
      m.model_name.toLowerCase().includes(query) ||
      m.model_type.toLowerCase().includes(query)
    )
  }

  if (filterType.value) {
    filtered = filtered.filter(m => m.model_type === filterType.value)
  }

  if (filterVendor.value) {
    filtered = filtered.filter(m => m.vendor === filterVendor.value)
  }

  if (filterStatus.value !== null) {
    filtered = filtered.filter(m => m.is_enable === filterStatus.value)
  }
 
  return filtered
})

// 分頁數據
const paginatedData = computed(() => {
  const start = (page.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredModels.value.slice(start, end)
})

// 總頁數
const totalPages = computed(() => {
  return Math.ceil(filteredModels.value.length / itemsPerPage.value)
})

const showMessage = (message, color = 'success') => {
  emitter.emit('openSnackbar', { message, color })
}

const fetchModels = async () => {
  loading.value = true
  try {
    // 添加 includeDisabled=true 參數來獲取所有模型（包括停用的）
    const response = await axios.get('/model/getModelList?includeDisabled=true')
    const data = response.data
    
    if (data.code === 0) {
      const processedData = data.data.map(model => ({
        ...model,
        config: typeof model.config === 'string' ? JSON.parse(model.config) : model.config || {}
      }))
      
      // 同時更新 models 和 tableData.body
      models.value = processedData
      tableData.value.body = processedData
    } else {
      showMessage('載入模型列表失敗', 'error')
    }
  } catch (error) {
    console.error('載入模型列表失敗:', error)
    showMessage('載入模型列表失敗', 'error')
  } finally {
    loading.value = false
  }
}

const toggleStatus = async (model) => {
  try {
    const newStatus = model.is_enable === 1 ? 0 : 1
    const response = await axios.put('/model/updateModelList', {
      id: model.id,
      is_enable: newStatus
    })
    console.log("response : ",response)
    const data = response.data
    
    if (data.code === 0) {
      model.is_enable = newStatus
      showMessage(`模型已${newStatus === 1 ? '啟用' : '停用'}`)
    } else {
      showMessage('狀態更新失敗', 'error')    }
  } catch (error) {
    console.error('狀態更新失敗:', error)
    showMessage('狀態更新失敗', 'error')
  }
}

const editModel = (model) => {
  editedModel.value = {
    ...model,
    config: { ...model.config }
  }
  editDialog.value = true
}

const closeEditDialog = () => {
  editDialog.value = false
  activeTab.value = "basic-info"
  editedModel.value = {
    id: null,
    name: '',
    vendor: '',
    model_name: '',
    model_type: '',
    is_enable: true,
    config: {}
  }
}

const saveModel = async () => {
  if (!editForm.value.validate()) {
    return
  }

  saving.value = true
  try {
    const response = await axios.put('/model/updateModelList', editedModel.value)
    const data = response.data
    
    if (data.code === 0) {
      // 處理後端返回的數據，確保 config 是對象格式
      const updatedModel = {
        ...data.data,
        config: typeof data.data.config === 'string' ? JSON.parse(data.data.config) : data.data.config
      }
      
      // 更新本地數據
      const index = models.value.findIndex(m => m.id === editedModel.value.id)
      if (index !== -1) {
        models.value[index] = updatedModel
        tableData.value.body[index] = updatedModel
      }
      
      showMessage('模型更新成功')
      closeEditDialog()
    } else {
      showMessage(`模型更新失敗: ${data.message || '未知錯誤'}`, 'error')
    }
  } catch (error) {
    console.error('模型更新失敗:', error)
    showMessage('模型更新失敗', 'error')
  } finally {
    saving.value = false
  }
}

// 排序功能
const sort = (sortObj, preserveOrder = false) => {
  if (!preserveOrder) {
    sortObj.orderBy = sortObj.orderBy === "asc" ? "desc" : "asc";
  }
  currentSort.value = { ...sortObj };

  if (sortObj.orderBy === "asc") {
    tableData.value.body = tableData.value.body.sort((a, b) => {
      if (a[sortObj.field] > b[sortObj.field]) return 1;
      if (a[sortObj.field] < b[sortObj.field]) return -1;
      return 0;
    });
  } else if (sortObj.orderBy === "desc") {
    tableData.value.body = tableData.value.body.sort((a, b) => {
      if (a[sortObj.field] > b[sortObj.field]) return -1;
      if (a[sortObj.field] < b[sortObj.field]) return 1;
      return 0;
    });
  }
}

// 監聽每頁數量變化，重置頁碼
watch(itemsPerPage, () => {
  page.value = 1;
})

// 監聽搜尋變化，重置頁碼
watch([searchQuery, filterType, filterVendor, filterStatus], () => {
  page.value = 1;
})


// Header 動作配置
const headerActions = computed(() => [
  {
    id: 'refresh',
    text: '更新資料',
    icon: 'mdi-refresh',
    color: 'info',
    loading: loading.value,
  }
])

const handleHeaderAction = (actionId) => {
  switch (actionId) {
    case 'refresh':
      fetchModels()
      break
  }
}

// 複製到剪貼簿
const copyToClipboard = (text) => {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      showMessage('ID 已複製到剪貼簿', 'success')
    })
    .catch((err) => {
      showMessage('複製失敗', 'error')
    });
}

// 初始化
onMounted(() => {
  fetchModels()
})
</script>


<template>
    
<div class="settings-container">

    <SystemHeader
        title="模型管理"
        subtitle="管理系統中的所有LLM模型配置，包含模型參數設定與啟用狀態"
        icon="mdi-robot"
        :actions="headerActions"
        @action="handleHeaderAction"
    />

    <!-- 搜尋與篩選區域 -->
    <v-card class="mb-4" elevation="2">
      <v-card-text>
        <div class="d-flex flex-wrap align-center gap-4">
          <div class="flex-grow-1" style="min-width: 200px;">
            <v-text-field
              v-model="searchQuery"
              label="搜尋模型"
              placeholder="請輸入模型名稱、供應商或模型類別..."
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="compact"
              clearable
              hide-details
            />
          </div>
          <div style="min-width: 150px;">
            <v-select
              v-model="filterType"
              :items="typeOptions"

              label="模型類別"
              variant="outlined"
              density="compact"
              clearable
              hide-details
            />
          </div>
          <div style="min-width: 150px;">
            <v-select
              v-model="filterVendor"
              :items="vendorOptions"
              label="供應商"
              variant="outlined"
              density="compact"
              clearable
              hide-details
            />
          </div>
          <div style="min-width: 120px;">
            <v-select
              v-model="filterStatus"
              :items="statusOptions"
              label="狀態"
              variant="outlined"
              density="compact"
              clearable
              hide-details
            />
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- 表格區域 -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th
              v-for="(item, index) in tableData.header"
              :key="index"
              v-show="visibleColumns.includes(index)"
            >
              <div v-if="item.sort" class="sort" @click="sort(item.sort)">
                <span>{{ item.title }}</span>
                <span
                  :class="{
                    'mdi mdi-chevron-down': item.sort.orderBy == 'asc',
                    'mdi mdi-chevron-up': item.sort.orderBy == 'desc',
                  }"
                ></span>
              </div>
              <span v-else>{{ item.title }}</span>
            </th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <div
            class="justify-center py-3 w-100 d-flex"
            style="background-color: #dddddd"
            v-if="tableData.body?.length === 0"
          >
            <p v-if="loading">載入中...</p>
            <p v-else>查無資料</p>
          </div>

          <tr
            v-for="(item, index) in paginatedData"
            :key="item.id"
          >
            <td style="cursor: pointer" @click="copyToClipboard(item.id)">
              <v-tooltip location="top" :text="`ID: ${item.id}`">
                <template v-slot:activator="{ props }">
                  <span v-bind="props">{{ (page - 1) * itemsPerPage + index + 1 }}</span>
                </template>
              </v-tooltip>
            </td>

            <!-- 名稱欄位 -->
            <td v-show="visibleColumns.includes(0)">
              <div class="d-flex align-center">
                <div>
                  <div class="font-weight-medium">{{ item.name }}</div>
                </div>
              </div>
            </td>

            <!-- 供應商欄位 -->
            <td v-show="visibleColumns.includes(1)">
              <v-chip
                variant="tonal"
                size="small"
              >
                {{ item.vendor }}
              </v-chip>
            </td>

            <!-- 模型名稱欄位 -->
            <td v-show="visibleColumns.includes(2)">
              {{ item.model_name }}
            </td>

            <!-- 模型類別欄位 -->
            <td v-show="visibleColumns.includes(3)">
              <v-chip
                variant="tonal"
                size="small"
              >
                {{ getModelTypeLabel(item.model_type) }}
              </v-chip>
            </td>

            <!-- 啟用狀態欄位 -->
            <td v-show="visibleColumns.includes(4)">
              <v-switch
                :model-value="item.is_enable === 1"
                @update:model-value="toggleStatus(item)"
                color="primary"
                hide-details
                inset
              />
            </td>

            <!-- 操作欄位 -->
            <td>
              <div class="d-flex align-center gap-2">
                <v-btn
                  icon="mdi-pencil"
                  variant="tonal"
                  size="small"
                  color="primary"
                  @click="editModel(item)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 分頁控制 -->
      <div class="table-pagination" v-if="filteredModels.length > 0">
       
        
        <div class="pagination-controls">
          <div class="items-per-page">
            <span class="pagination-label">每頁顯示筆數</span>
            <v-select
              v-model="itemsPerPage"
              :items="options"
              item-title="title"
              item-value="value"
              hide-details
              density="compact"
              variant="outlined"
              style="width: 80px; margin-left: 8px;"
            />
          </div>
          
          <div class="pagination-info">
          <span class="pagination-text">
            {{ Math.min((page - 1) * itemsPerPage + 1, filteredModels.length) }}-{{ Math.min(page * itemsPerPage, filteredModels.length) }} 共 {{ filteredModels.length }}筆
          </span>

        </div>
          <v-pagination
            v-model="page"
            :length="totalPages"
            :total-visible="7"
            density="comfortable"
            class="ml-4"
            v-if="totalPages > 1"
          />
        </div>
        
      </div>
    </div>

    <!-- 編輯對話框 -->
    <v-dialog v-model="editDialog" max-width="800px" persistent>
      <v-card>
        <v-card-title class="text-white text-h5 bg-primary">編輯模型</v-card-title>
        
        <v-card-text>
          <v-tabs v-model="activeTab" color="primary">
            <v-tab value="model-params">模型參數</v-tab>
            <v-tab value="basic-info">模型基本資料</v-tab>
          </v-tabs>

          <v-window v-model="activeTab">
            <!-- 模型基本資料分頁 -->
            <v-window-item value="basic-info">
              <v-container>
                <v-form ref="editForm" v-model="editFormValid">
                  <v-row>
                    <v-col cols="12" md="6">
                      <v-text-field
                        v-model="editedModel.name"
                        label="名稱"
                        variant="filled"
                       
                        required
                        :disabled="true"
                      />
                    </v-col>
                    
                    <v-col cols="12" md="6">
                      <v-text-field
                        v-model="editedModel.vendor"
                        label="供應商"
                        variant="filled"
                       
                        required
                        :disabled="true"
                      />
                    </v-col>
                    
                    <v-col cols="12" md="6">
                      <v-text-field
                        v-model="editedModel.model_name"
                        label="模型名稱"
                        variant="filled"
                        
                        required
                        :disabled="true"
                      />
                    </v-col>
                    
                    <v-col cols="12" md="6">
                      <v-select
                        v-model="editedModel.model_type"
                        :items="allTypeOptions"
                        label="模型類別"
                        variant="filled"
                        required
                        :disabled="true"
                      />
                    </v-col>
                    
                    <v-col cols="12">
                      <v-switch
                        :model-value="editedModel.is_enable === 1"
                        @update:model-value="editedModel.is_enable = $event ? 1 : 0"
                        label="是否啟用"
                        color="primary"
                        hide-details
                      />
                    </v-col>
                  </v-row>
                </v-form>
              </v-container>
            </v-window-item>

            <!-- 模型參數分頁 -->
            <v-window-item value="model-params">
              <v-container>
                <v-row>
                  <v-col cols="12">
                    <v-textarea
                      v-model="editedModel.config.system_prompt"
                      label="System Prompt"
                      variant="filled"
                      rows="5"
                      no-resize
                      persistent-hint
                      hint="設置模型的初始行為和背景知識"
                    >
                      <template v-slot:append>
                        <v-tooltip location="top">
                          <template v-slot:activator="{ props }">
                            <v-icon v-bind="props" color="grey">mdi-help-circle-outline</v-icon>
                          </template>
                          System Prompt 用於定義模型的初始狀態、角色或行為。它為模型提供上下文和指導。
                        </v-tooltip>
                      </template>
                    </v-textarea>
                  </v-col>
                  
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model.number="editedModel.config.top_p"
                      label="Top P"
                      type="number"
                      variant="filled"
                      step="0.1"
                      min="0"
                      max="1"
                      hint="控制輸出的多樣性（0至1）"
                      persistent-hint
                      :rules="[v => v >= 0 && v <= 1 || 'Top P 必須介於 0 到 1 之間']"
                    >
                      <template v-slot:append>
                        <v-tooltip location="top">
                          <template v-slot:activator="{ props }">
                            <v-icon v-bind="props" color="grey">mdi-help-circle-outline</v-icon>
                          </template>
                          Top P（核心採樣）決定模型在生成文本時考慮的候選詞彙範圍。較低的值會產生更加確定和重複的輸出，較高的值會增加多樣性。
                        </v-tooltip>
                      </template>
                    </v-text-field>
                  </v-col>
                  
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model.number="editedModel.config.max_tokens"
                      label="Max Tokens"
                      type="number"
                      variant="filled"
                      min="1"
                      hint="設置生成文本的最大長度"
                      persistent-hint
                      :rules="[v => v > 0 || 'Max Tokens 必須大於 0']"
                    >
                      <template v-slot:append>
                        <v-tooltip location="top">
                          <template v-slot:activator="{ props }">
                            <v-icon v-bind="props" color="grey">mdi-help-circle-outline</v-icon>
                          </template>
                          Max Tokens 限制模型在一次對話中生成的最大標記（詞）數。這有助於控制輸出的長度和計算成本。
                        </v-tooltip>
                      </template>
                    </v-text-field>
                  </v-col>
                  
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model.number="editedModel.config.temperature"
                      label="Temperature"
                      type="number"
                      variant="filled"
                      step="0.1"
                      min="0"
                      max="2"
                      hint="控制輸出的隨機性（0至2）"
                      persistent-hint
                      :rules="[v => v >= 0 && v <= 2 || 'Temperature 必須介於 0 到 2 之間']"
                    >
                      <template v-slot:append>
                        <v-tooltip location="top">
                          <template v-slot:activator="{ props }">
                            <v-icon v-bind="props" color="grey">mdi-help-circle-outline</v-icon>
                          </template>
                          Temperature 控制生成文本的隨機性。較低的值會產生更加確定和一致的輸出，較高的值會增加創造性和不可預測性。
                        </v-tooltip>
                      </template>
                    </v-text-field>
                  </v-col>
                  
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model.number="editedModel.config.frequency_penalty"
                      label="Frequency Penalty"
                      type="number"
                      variant="filled"
                      step="0.1"
                      min="-2"
                      max="2"
                      hint="降低重複詞語的使用（-2.0至2.0）"
                      persistent-hint
                      :rules="[v => v >= -2 && v <= 2 || 'Frequency Penalty 必須介於 -2 到 2 之間']"
                    >
                      <template v-slot:append>
                        <v-tooltip location="top">
                          <template v-slot:activator="{ props }">
                            <v-icon v-bind="props" color="grey">mdi-help-circle-outline</v-icon>
                          </template>
                          Frequency Penalty 用於減少文本中單詞和短語的重複。正值會降低已出現詞語的出現機率，有助於產生更多樣化的輸出。
                        </v-tooltip>
                      </template>
                    </v-text-field>
                  </v-col>
                </v-row>
              </v-container>
            </v-window-item>
          </v-window>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="closeEditDialog"
          >
            取消
          </v-btn>
          <v-btn
            color="primary"
            variant="text"
            :loading="saving"
            :disabled="!editFormValid"
            @click="saveModel"
          >
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
</div>


</template>


<style scoped>
.settings-container {
  padding: 2em;
}

@media (max-width: 960px) {
  .settings-container {
    padding: 1em;
  }
}

.mark3 {
  color: #2196f3;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 16px;
  background-color: #ffffff;
  border-top: 1px solid #e0e0e0;
  min-height: 64px;

  .pagination-info {
    display: flex;
    align-items: center;
    
    .pagination-text {
      font-size: 0.875rem;
      color: rgba(0, 0, 0, 0.6);
    }
  }

  .pagination-controls {
    display: flex;
    align-items: center;
    gap: 24px;

    .items-per-page {
      display: flex;
      align-items: center;
      
      .pagination-label {
        font-size: 0.875rem;
        color: rgba(0, 0, 0, 0.6);
        white-space: nowrap;
      }
    }
  }
}

:deep(.v-pagination) {
  .v-pagination__list {
    justify-content: flex-end;
  }
}

:deep(.v-select.v-input--density-compact .v-field) {
  font-size: 0.875rem;
}

.table-container {
  margin-bottom: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
  background-color: #ffffff;
}

table {
  width: 100%;
  background-color: #ffffff;

  tbody {
    tr {
      position: relative;
      background-color: #ffffff;
      &:hover {
        background-color: #ebf5ff;
      }
    }
  }

  tr {
    display: flex;
    border-bottom: 1px solid #e5e7eb;
    min-height: 48px;
    width: 100%;

    th,
    td {
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      padding: 0.5rem;
      overflow: hidden;

      &:nth-child(1) {
        flex: 0 0 50px;
      }
      &:nth-child(2) {
        flex: 1 1 200px;
        min-width: 150px;
      }
      &:nth-child(3) {
        flex: 1 1 120px;
        min-width: 100px;
      }
      &:nth-child(4) {
        flex: 1 1 150px;
        min-width: 120px;
      }
      &:nth-child(5) {
        flex: 1 1 120px;
        min-width: 100px;
      }
      &:nth-child(6) {
        flex: 0 0 100px;
      }
      &:nth-child(7) {
        flex: 0 0 100px;
      }

      &[style*="display: none"] {
        flex: 0 0 0px !important;
        padding: 0 !important;
        margin: 0 !important;
      }
    }
  }

  thead {
    tr {
      background-color: #f9fafb;
      th {
        font-weight: 500;
        color: #666666;

        .sort {
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
        }
      }
    }
  }
}

[v-show="false"] {
  display: none !important;
  width: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
}

:deep(.column-settings-trigger) {
  margin-top: -7px;
  height: 40px;
}
</style>
