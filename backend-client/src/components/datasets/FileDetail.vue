<script setup>
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const props = defineProps({
    fileInfo: {
        type: Object,
        required: true
    }
});

// UTC轉台北時間
const fileDetalFormat = (date) => {
    return dayjs(date).tz('Asia/Taipei').format('YYYY-MM-DD HH:mm:ss');
}

// 複製到剪貼簿
const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        console.log('已複製到剪貼簿:', text);
    }).catch(err => {
        console.error('複製失敗:', err);
    });
};
</script>
<template>
    <div class="overlay">
        <div class="modal">
        <h3>檔案詳細資料</h3>
        <ul>
            <li @click="copyToClipboard(fileInfo.id)" style="cursor: pointer;">
                <strong>ID：</strong> {{ fileInfo.id || '無' }}
            </li>
            <li>
                <strong>原始名稱：</strong> {{ fileInfo.originalname || '無' }}
            </li>
            <li>
                <strong>分隔符：</strong> {{ fileInfo.separator || '系統預設' }}
            </li>
            <li>
                <strong>資料來源名稱：</strong> {{ fileInfo.datasource_name || '無' }}
            </li>
            <li>
                <strong>資料來源 URL：</strong> {{ fileInfo.datasource_url || '無' }}
            </li>
            <li>
                <strong>到期時間：</strong>
                {{ fileInfo.expiration_time ? fileDetalFormat(fileInfo.expiration_time) : '無' }}
            </li>
            <li>
                <strong>建立者：</strong> {{ fileInfo.created_by || '無' }}
            </li>
            <li>
                <strong>更新者：</strong> {{ fileInfo.updated_by || '無' }}
            </li>
            <li>
                <strong>建立時間：</strong>
                {{ fileInfo.create_time ? fileDetalFormat(fileInfo.create_time) : '無' }}
            </li>
            <li>
                <strong>更新時間：</strong>
                {{ fileInfo.update_time ? fileDetalFormat(fileInfo.update_time) : '無' }}
            </li>
            <!-- <li>
                <strong>是否啟用：</strong> {{ fileInfo.is_enable || '無' }}
            </li>
            <li>
                <strong>訓練狀態：</strong> {{ fileInfo.training_state || '無' }}
            </li> -->
        </ul>
        <button @click="$emit('close')">關閉</button>
        </div>
    </div>
</template>

<style scoped>
.overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
}

.modal {
    background-color: #fff;
    border-radius: 8px;
    padding: 2rem;
    max-width: 600px;
    width: 90%;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    animation: scaleIn 0.2s ease-out;
}

@keyframes scaleIn {
    from {
        transform: scale(0.8);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}

.modal h3 {
    margin-top: 0;
    margin-bottom: 1.5rem;
    text-align: center;
    font-size: 1.5rem;
    color: #333;
    font-weight: bold;
}

.modal ul {
    list-style: none;
    padding: 0;
    margin: 0 0 1.5rem 0;
}

.modal ul li {
    margin-bottom: 0.8rem;
    font-size: 1rem;
    color: #555;
    border-bottom: 1px solid #eee;
    padding-bottom: 0.4rem;
}

button {
    display: block;
    margin: 0 auto;
    padding: 0.6rem 1.2rem;
    background-color: #007bff;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s ease;
}

button:hover {
    background-color: #0056b3;
}
</style> 