<script setup>
import { ref, inject, watch } from "vue";
import { useQuery, useMutation } from "@tanstack/vue-query";
import VirtualAutocomplete from "@/components/common/VirtualAutocomplete.vue";

const axios = inject("axios");

const selectedUsers = ref([]);

const selectedUserIds = ref([]);

// 透過 Vue Query 取得 API 資料
const { data: users, isLoading } = useQuery({
    queryKey: ["kh-users"],
    queryFn: async () => {
        const response = await axios.get("/system/getKHUsers");
        return response.data.data; // API 回傳的使用者資料
    },
});

// **監聽 `selectedUserIds` 變化並更新 `selectedUsers`**
watch(selectedUserIds, (newIds) => {
    if (users.value) {
        selectedUsers.value = users.value.filter((user) => newIds.includes(user.auth_id));
    }
});

// **下載 Excel**
const { mutate: exportDepartmentUsers } = useMutation({
    mutationFn: async () => {
        const response = await axios.post(
            "/system/exportDepartmentUsers",
            { selectedUsers: selectedUsers.value },
            { responseType: "blob" }
        );

        const blob = new Blob([response.data], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `department_users_${Date.now()}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },
});

function submitSelection() {
    console.log("選取的使用者", selectedUsers.value);
    exportDepartmentUsers();
}
</script>

<template>
    <v-container>
        <VirtualAutocomplete
            v-model="selectedUserIds"
            :items="users || []"
            item-title="name"
            item-value="auth_id"
            multiple
            clearable
            :loading="isLoading"
        />

        <v-btn color="primary" class="mt-4" @click="submitSelection">🥞🍗🥩🥓🍔🍟🥪🥙</v-btn>
    </v-container>
</template>
