<script setup>
import { ref, inject, computed } from "vue";

const axios = inject("axios");
const emitter = inject("emitter");

const props = defineProps({
    fileInfo: { type: Object, default: () => ({}) },
    datasets_id: { type: String, default: "" },
});

const emit = defineEmits(["update:documentFile"]);

const dialog = ref(false);
const localEditedInfo = ref(null);

const openDialog = () => {
    const expirationDate = props.fileInfo.expiration_time ? new Date(props.fileInfo.expiration_time) : null;
    localEditedInfo.value = {
        id: props.fileInfo.id,
        datasource_name: props.fileInfo.datasource_name,
        datasource_url: props.fileInfo.datasource_url,
        expirationDate: expirationDate ? expirationDate.toISOString().split("T")[0] : "",
        expirationTime: expirationDate ? expirationDate.toTimeString().split(" ")[0].substr(0, 5) : "",
    };
    dialog.value = true;
};

const closeDialog = () => {
    dialog.value = false;
};

const saveChanges = async () => {
    try {
        let utcExpiration = null;
        if (localEditedInfo.value.expirationDate && localEditedInfo.value.expirationTime) {
            const localDate = new Date(
                `${localEditedInfo.value.expirationDate}T${localEditedInfo.value.expirationTime}:00`
            );
            utcExpiration = localDate.toISOString();
        }

        const response = await axios.put(`/datasets/editDocumentSource`, {
            datasets_id: props.datasets_id,
            document_id: localEditedInfo.value.id,
            datasource_name: localEditedInfo.value.datasource_name,
            datasource_url: localEditedInfo.value.datasource_url,
            expiration_time: utcExpiration,
        });

        if (response.data.code === 0) {
            emitter.emit("openSnackbar", { message: "更新成功", color: "success" });
            emit("update:documentFile");
            closeDialog();
        }
    } catch (error) {
        console.error("Error updating document:", error);
        emitter.emit("openSnackbar", { message: "更新失敗", color: "error" });
    }
};

const editedInfo = computed(
    () =>
        localEditedInfo.value || {
            datasource_name: "",
            datasource_url: "",
            expirationDate: "",
            expirationTime: "",
        }
);
</script>

<template>
    <div class="text-center">
        <button @click="openDialog">
            <i class="fa-solid fa-file-pen icon-hover"></i>
            <v-tooltip activator="parent" location="top">編輯文件來源顯示名稱與連結</v-tooltip>
        </button>

        <v-dialog v-model="dialog" max-width="500px">
            <v-card v-if="dialog">
                <v-card-title>
                    <span class="text-h5">編輯文件來源</span>
                </v-card-title>

                <v-card-text>
                    <v-container>
                        <v-row>
                            <v-col cols="12">
                                <v-text-field v-model="editedInfo.datasource_name" label="來源顯示名稱"></v-text-field>
                            </v-col>
                            <v-col cols="12">
                                <v-text-field v-model="editedInfo.datasource_url" label="來源連結(URL)"></v-text-field>
                            </v-col>
                            <v-col cols="12" sm="6">
                                <v-text-field
                                    v-model="editedInfo.expirationDate"
                                    label="過期日期"
                                    type="date"
                                    clearable
                                ></v-text-field>
                            </v-col>
                            <v-col cols="12" sm="6">
                                <v-text-field
                                    v-model="editedInfo.expirationTime"
                                    label="過期時間"
                                    type="time"
                                    clearable
                                ></v-text-field>
                            </v-col>
                        </v-row>
                    </v-container>
                </v-card-text>

                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="blue-darken-1" variant="text" @click="closeDialog">取消</v-btn>
                    <v-btn color="blue-darken-1" variant="text" @click="saveChanges">儲存</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<style scoped>
.v-btn {
    margin-right: 8px;
}
</style>
