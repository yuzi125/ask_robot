<script setup>
import DBQuery from "@/components/system/db/DBQuery.vue";
import DBVersionUpdate from "@/components/system/db/DBVersionUpdate.vue";
import DBBackupManagement from "@/components/system/db/DBBackupManagement.vue";
import SelectiveTableBackup from "@/components/system/db/SelectiveTableBackup.vue";
import DownloadFileManagement from "@/components/system/db/DownloadFileManagement.vue";
import CreateUser from "@/components/system/db/CreateUser.vue";
import ExportDepartmentUsers from "@/components/system/db/ExportDepartmentUsers.vue";
import VectorOperations from "@/components/system/db/VectorOperations.vue";
import UploadJsonFiles from "@/components/system/db/UploadJsonFiles.vue";
import RefactorTableComponent from "@/components/system/db/RefactorTableComponent.vue";
</script>

<template>
    <div class="db_view">
        <v-container fluid>
            <v-row>
                <v-col cols="12">
                    <DBQuery />
                </v-col>
                <v-col cols="12">
                    <CreateUser />
                </v-col>
                <v-col cols="12">
                    <RefactorTableComponent />
                </v-col>
                <!-- <v-col cols="12">
                    <DBVersionUpdate />
                </v-col>
                 -->
                <!-- <v-col cols="12">
                    <DBBackupManagement />
                </v-col> -->
                <v-col cols="12">
                    <SelectiveTableBackup />
                </v-col>
                <v-col cols="12">
                    <DownloadFileManagement />
                </v-col>
                <v-col cols="12">
                    <UploadJsonFiles />
                </v-col>
                <v-col cols="12">
                    <ExportDepartmentUsers />
                </v-col>
                <v-col cols="12">
                    <VectorOperations />
                </v-col>
            </v-row>
        </v-container>
    </div>
</template>

<style lang="scss" scoped>
.db_view {
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: white;
    display: flex;
    flex-direction: column;
    overflow-y: auto;

    .fields {
        display: flex;
        flex-wrap: wrap;

        .field {
            width: 100%;
        }
    }
}
</style>
