<script setup>
import { ref, inject, watchEffect, computed, onMounted, watch } from "vue";
import defaultAxios from "axios";
import { downloadLogFile } from "../utils/downloadLog";
const axios = inject("axios");
const emitter = inject("emitter");

let nowDate = new Date();
nowDate = `${nowDate.getFullYear()}-${(nowDate.getMonth() + 1).toString().padStart(2, "0")}-${nowDate
    .getDate()
    .toString()
    .padStart(2, "0")}`;

const backend_filenames = ref([]);
const backend_params = ref({});
const backend_log = ref([]);
const backend_filter = ref({});
const backend_filter_v = ref({ sort: "desc", level: "all", search: "" });

const file_service_backend_filenames = ref([]);
const file_service_backend_params = ref({});

const backend_log_list = computed(() => {
    if (backend_filter_v.value.level === "all") {
        if (backend_filter_v.value.search === "") {
            return backend_log.value;
        } else {
            return backend_log.value.filter((f) => f.message.indexOf(backend_filter_v.value.search) !== -1);
        }
    } else {
        return backend_log.value.filter(
            (f) => f.level === backend_filter_v.value.level && f.message.indexOf(backend_filter_v.value.search) !== -1
        );
    }
});

const chat_filenames = ref([]);
const chat_params = ref({});
const chat_log = ref([]);
const chat_filter = ref({});
const chat_filter_v = ref({ sort: "desc", level: "all", search: "" });

const chat_log_list = computed(() => {
    if (chat_filter_v.value.level === "all") {
        if (chat_filter_v.value.search === "") {
            return chat_log.value;
        } else {
            return chat_log.value.filter((f) => f.message.indexOf(chat_filter_v.value.search) !== -1);
        }
    } else {
        return chat_log.value.filter(
            (f) => f.level === chat_filter_v.value.level && f.message.indexOf(chat_filter_v.value.search) !== -1
        );
    }
});

onMounted(() => {
    init();
});
function init() {
    axios.get("/log/filenames").then((rs) => {
        if (rs.data.code === 0) {
            backend_filenames.value = rs.data.data;
            backend_params.value = { filename: backend_filenames.value[0], time: nowDate, count: 0 };
        } else {
            emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
        }
    });

    axios.get("/log/getFileServiceBackendServerLogFileList").then((rs) => {
        try {
            file_service_backend_filenames.value = rs.data.logs;
            file_service_backend_params.value = {
                filename: file_service_backend_filenames.value[0],
                time: nowDate,
                count: 0,
            };
        } catch (error) {
            emitter.emit("openSnackbar", { message: error.message, color: "error" });
        }
    });

    defaultAxios.get("/ava/chat/log/filenames").then((rs) => {
        if (rs.data.code === 0) {
            chat_filenames.value = rs.data.data;
            chat_params.value = { filename: chat_filenames.value[0], time: nowDate, count: 0 };
        } else {
            emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
        }
    });
    defaultAxios
        .post("/ava/api/readLogFileName", {}, { headers: { "Content-Type": "application/json" } })
        .then((rs) => {
            if (rs.data.code === 200) {
                python_filenames.value = rs.data.data;
                // python_params.value = { filename: python_filenames.value[0], time: nowDate, count: 0, sort:"desc" };
                python_params.value = { filename: "log/ava_app.log", time: nowDate, count: 0, sort: "desc" };
            } else {
                emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
            }
        });
}

const projects = ref(["backend", "chat", "sql", "python", "file-service-backend"]);
const project = ref("backend");

const node_filenames = ["log/sql.log"];
const python_filenames = ref([]);
// const python_filenames = [
//     "log/ava_app.log",
//     "log/ava_debug.log",
//     "log/ava_doc_searcher.log",
//     "log/ava_error.log",
//     "log/ava_info.log",
//     "log/ava_token.log",
//     "log/ava_whisper.log",
//     "log/ava_wish_collector.log",
// ];
// const python_params = ref({ filename: python_filenames.value[0], time: nowDate, count: 0 });
// const docker_filenames = [
//     "ava-api-server-dev",
//     "ava-backend-server-dev",
//     "ava-nginx-dev",
//     "ava-chat-server-dev",
//     "ava-redis-server-dev",
//     "ava-chat-db",
// ];
// const docker_filename = ref("");
// const docker_log = ref("");

const node_params = ref({ filename: node_filenames[0], time: nowDate, count: 0 });
const python_params = ref({});

const node_log = ref([]);
const python_log = ref([]);

const node_filter = ref({ sort: ["asc", "desc"], status: ["all", "success", "error"] });
const node_filter_v = ref({ sort: "desc", status: "all", search: "" });
const python_filter = ref({});
const python_filter_v = ref({ sort: "desc", level: "all", search: "" });

const node_log_list = computed(() => {
    if (node_filter_v.value.status === "all") {
        if (node_filter_v.value.search === "") {
            return node_log.value;
        } else {
            return node_log.value.filter((f) => f.sql.indexOf(node_filter_v.value.search) !== -1);
        }
    } else {
        return node_log.value.filter(
            (f) => f.status === node_filter_v.value.status && f.sql.indexOf(node_filter_v.value.search) !== -1
        );
    }
});
const python_log_list = computed(() => {
    if (python_filter_v.value.level === "all") {
        if (python_filter_v.value.search === "") {
            return python_log.value;
        } else {
            return python_log.value.filter((f) => f.message.indexOf(python_filter_v.value.search) !== -1);
        }
    } else {
        return python_log.value.filter(
            (f) => f.level === python_filter_v.value.level && f.message.indexOf(python_filter_v.value.search) !== -1
        );
    }
});
watch(project, (newV) => {
    let temp_log;
    switch (newV) {
        case "chat":
            temp_log = chat_log.value;
            chat_log.value = [];
            logBatchShow(temp_log, 1, 30, (data) => {
                chat_log.value.push(...data);
            });
            break;
        case "backend":
            temp_log = backend_log.value;
            backend_log.value = [];
            logBatchShow(temp_log, 1, 30, (data) => {
                backend_log.value.push(...data);
            });
            break;
        case "python":
            temp_log = python_log.value;
            python_log.value = [];
            logBatchShow(temp_log, 1, 30, (data) => {
                python_log.value.push(...data);
            });
            break;
    }
});
watchEffect(() => {
    if (chat_filter_v.value.sort === "desc") {
        chat_log.value = chat_log.value.sort((a, b) => {
            return new Date(b.time) - new Date(a.time);
        });
    } else if (chat_filter_v.value.sort === "asc") {
        chat_log.value = chat_log.value.sort((a, b) => {
            return new Date(a.time) - new Date(b.time);
        });
    }

    if (backend_filter_v.value.sort === "desc") {
        backend_log.value = backend_log.value.sort((a, b) => {
            return new Date(b.time) - new Date(a.time);
        });
    } else if (backend_filter_v.value.sort === "asc") {
        backend_log.value = backend_log.value.sort((a, b) => {
            return new Date(a.time) - new Date(b.time);
        });
    }

    if (node_filter_v.value.sort === "desc") {
        node_log.value = node_log.value.sort((a, b) => {
            return new Date(b.time) - new Date(a.time);
        });
    } else if (node_filter_v.value.sort === "asc") {
        node_log.value = node_log.value.sort((a, b) => {
            return new Date(a.time) - new Date(b.time);
        });
    }

    if (python_filter_v.value.sort === "desc") {
        python_log.value = python_log.value.sort((a, b) => {
            return new Date(b.timestamp.split(",")[0]) - new Date(a.timestamp.split(",")[0]);
        });
    } else if (python_filter_v.value.sort === "asc") {
        python_log.value = python_log.value.sort((a, b) => {
            return new Date(a.timestamp.split(",")[0]) - new Date(b.timestamp.split(",")[0]);
        });
    }
});

async function getChatLog() {
    let rs = await defaultAxios.get(
        `/ava/chat/log/file?filename=${chat_params.value.filename}&count=${chat_params.value.count}`
    );
    if (rs.data.code === 0) {
        // db_output.value = rs.data.data;
        emitter.emit("openSnackbar", { message: "成功執行", color: "success" });
        let temp_log = rs.data.data.reverse();
        chat_log.value = [];
        logBatchShow(temp_log, 1, 30, (data) => {
            chat_log.value.push(...data);
        });
        console.log(rs.data.data);
        const uniqueLevels = [...new Set(rs.data.data.map((item) => item.level))];
        chat_filter.value = { sort: ["asc", "desc"], level: ["all", ...uniqueLevels] };
    } else {
        // db_output.value = rs.data.message;
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
        console.log(rs.data.message);
    }
}

async function getBackendLog() {
    let rs = await axios.get(`/log/file?filename=${backend_params.value.filename}&count=${backend_params.value.count}`);
    if (rs.data.code === 0) {
        // db_output.value = rs.data.data;
        emitter.emit("openSnackbar", { message: "成功執行", color: "success" });
        let temp_log = rs.data.data.reverse();
        backend_log.value = [];
        logBatchShow(temp_log, 1, 30, (data) => {
            backend_log.value.push(...data);
        });
        console.log(rs.data.data);
        const uniqueLevels = [...new Set(rs.data.data.map((item) => item.level))];
        backend_filter.value = { sort: ["asc", "desc"], level: ["all", ...uniqueLevels] };
    } else {
        // db_output.value = rs.data.message;
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
        console.log(rs.data.message);
    }
}

//* 需要跨域的使用 defaultAxios 同源的使用 axios

async function downloadChatServerLogFile() {
    await downloadLogFile(
        defaultAxios,
        "/ava/chat/log/downloadLogFile", // API 路徑
        { filename: chat_params.value.filename }, // 傳遞的參數
        chat_params.value.filename, // 下載的文件名
        emitter // 傳遞 emitter
    );
}

async function downloadBackendServerLogFile() {
    await downloadLogFile(
        axios,
        "/log/downloadBackendServerLog", // API 路徑
        { filename: backend_params.value.filename }, // 傳遞的參數
        backend_params.value.filename, // 下載的文件名
        emitter // 傳遞 emitter
    );
}

async function downloadSQLLogFile() {
    await downloadLogFile(
        axios,
        "/log/downloadSQLLog", // API 路徑
        { time: node_params.value.time }, // 傳遞的參數
        `${node_params.value.time}-sql.log`, // 下載的文件名
        emitter // 傳遞 emitter
    );
}

async function downloadFileServiceBackendServerLogFile() {
    await downloadLogFile(
        axios,
        "/log/downloadFileServiceBackendServerLog", // API 路徑
        { filename: file_service_backend_params.value.filename }, // 傳遞的參數
        file_service_backend_params.value.filename, // 下載的文件名
        emitter // 傳遞 emitter
    );
}

async function downloadPythonLogFile() {
    await downloadLogFile(
        axios,
        "/log/downloadPythonLog", // API 路徑
        { filename: python_params.value.filename }, // 傳遞的參數
        python_params.value.filename, // 下載的文件名
        emitter // 傳遞 emitter
    );
}

async function getNodeLog() {
    let rs = await axios.post(
        "/system/log",
        JSON.stringify({
            project: project.value,
            filename: node_params.value.filename,
            time: node_params.value.time,
            count: node_params.value.count,
        })
    );
    if (rs.data.code === 0) {
        // db_output.value = rs.data.data;
        emitter.emit("openSnackbar", { message: "成功執行", color: "success" });
        node_log.value = rs.data.data;
        console.log(rs.data.data);
    } else {
        // db_output.value = rs.data.message;
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
        console.log(rs.data.message);
    }
}
async function logBatchShow(logArr, ms, count, callback) {
    for (let i = 0; i < logArr.length; i += count) {
        callback(logArr.slice(i, i + count));
        await new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
}
async function getPythonLog() {
    let rs = await axios.post(
        "/system/log",
        JSON.stringify({
            sort: python_params.value.sort,
            project: project.value,
            filename: python_params.value.filename,
            time: python_params.value.time,
            count: python_params.value.count,
        })
    );

    if (rs.data.code === 0) {
        // db_output.value = rs.data.data;
        emitter.emit("openSnackbar", { message: "成功執行", color: "success" });
        python_log.value = [];
        logBatchShow(rs.data.data, 1, 30, (data) => {
            python_log.value.push(...data);
        });
        const uniqueLevels = [...new Set(rs.data.data.map((item) => item.level))];
        python_filter.value = { sort: ["asc", "desc"], level: ["all", ...uniqueLevels] };
        console.log(rs.data.data);
    } else {
        // db_output.value = rs.data.message;
        emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
        console.log(rs.data.message);
    }
}
// async function getDockerLog() {
//     let rs = await axios.post(
//         "/system/log",
//         JSON.stringify({
//             project: project.value,
//             filename: docker_filename.value,
//             count: "1",
//         })
//     );
//     if (rs.data.code === 0) {
//         // db_output.value = rs.data.data;
//         emitter.emit("openSnackbar", { message: "成功執行", color: "success" });
//         console.log(rs.data.data);
//         docker_log.value = rs.data.data;
//     } else {
//         // db_output.value = rs.data.message;
//         emitter.emit("openSnackbar", { message: rs.data.message, color: "error" });
//         console.log(rs.data.message);
//     }
// }
const header = ref(null);
function hide() {
    header.value.classList.toggle("hide");
}
</script>

<template>
    <div class="log_view">
        <div class="header" ref="header">
            <div class="d-flex align-center">
                <v-select class="mx-2 w-25" label="選擇專案" :items="projects" v-model="project"></v-select>

                <div v-if="project === 'backend'" class="filter1 pa-2">
                    <v-autocomplete
                        class="mx-2"
                        label="選擇檔案"
                        :items="backend_filenames"
                        v-model="backend_params.filename"
                    ></v-autocomplete>
                    <v-text-field class="mx-2" label="筆數" v-model="backend_params.count" />
                    <v-btn @click="getBackendLog">搜索</v-btn>
                    <v-btn @click="downloadBackendServerLogFile">下載</v-btn>
                </div>
                <div v-if="project === 'chat'" class="filter1 pa-2">
                    <v-autocomplete
                        class="mx-2"
                        label="選擇檔案"
                        :items="chat_filenames"
                        v-model="chat_params.filename"
                    ></v-autocomplete>
                    <v-text-field class="mx-2" label="筆數" v-model="chat_params.count" />
                    <v-btn @click="getChatLog">搜索</v-btn>
                    <v-btn @click="downloadChatServerLogFile">下載</v-btn>
                </div>
                <div v-if="project === 'sql'" class="filter1 pa-2">
                    <v-autocomplete
                        class="mx-2"
                        label="選擇檔案"
                        :items="node_filenames"
                        v-model="node_params.filename"
                    ></v-autocomplete>
                    <v-text-field class="mx-2" label="筆數" v-model="node_params.count" />
                    <input class="mx-2" type="date" v-model="node_params.time" />
                    <v-btn @click="getNodeLog">搜索</v-btn>
                    <v-btn @click="downloadSQLLogFile">下載</v-btn>
                </div>
                <div v-if="project === 'python'" class="filter1 pa-2">
                    <v-autocomplete
                        class="mx-2"
                        label="選擇檔案"
                        :items="python_filenames"
                        v-model="python_params.filename"
                    ></v-autocomplete>
                    <v-select
                        v-if="project === 'python'"
                        class="mr-4"
                        label="搜尋排序"
                        :items="['asc', 'desc']"
                        v-model="python_params.sort"
                    ></v-select>
                    <v-text-field class="mx-2" label="筆數" v-model="python_params.count" />
                    <input class="mx-2" type="date" v-model="python_params.time" />
                    <v-btn @click="getPythonLog">搜索</v-btn>
                    <v-btn @click="downloadPythonLogFile">下載</v-btn>
                </div>

                <div v-if="project === 'file-service-backend'" class="filter1 pa-2">
                    <v-autocomplete
                        class="mx-2"
                        label="選擇檔案"
                        :items="file_service_backend_filenames"
                        v-model="file_service_backend_params.filename"
                    ></v-autocomplete>
                    <v-btn @click="downloadFileServiceBackendServerLogFile">下載</v-btn>
                </div>
            </div>

            <div v-if="project === 'backend'" class="px-2 d-flex">
                <v-select
                    class="mr-4"
                    label="排序"
                    :items="backend_filter.sort"
                    v-model="backend_filter_v.sort"
                ></v-select>
                <v-select
                    class="mr-4"
                    label="狀態"
                    :items="backend_filter.level"
                    v-model="backend_filter_v.level"
                ></v-select>
                <v-text-field label="搜尋" v-model="backend_filter_v.search" />
            </div>
            <div v-if="project === 'chat'" class="px-2 d-flex">
                <v-select class="mr-4" label="排序" :items="chat_filter.sort" v-model="chat_filter_v.sort"></v-select>
                <v-select class="mr-4" label="狀態" :items="chat_filter.level" v-model="chat_filter_v.level"></v-select>
                <v-text-field label="搜尋" v-model="chat_filter_v.search" />
            </div>
            <div v-if="project === 'sql'" class="px-2 d-flex">
                <v-select class="mr-4" label="排序" :items="node_filter.sort" v-model="node_filter_v.sort"></v-select>
                <v-select
                    class="mr-4"
                    label="狀態"
                    :items="node_filter.status"
                    v-model="node_filter_v.status"
                ></v-select>
                <v-text-field label="搜尋" v-model="node_filter_v.search" />
            </div>
            <div v-if="project === 'python'" class="px-2 d-flex">
                <v-select
                    class="mr-4"
                    label="排序"
                    :items="python_filter.sort"
                    v-model="python_filter_v.sort"
                ></v-select>
                <v-select
                    class="mr-4"
                    label="狀態"
                    :items="python_filter.level"
                    v-model="python_filter_v.level"
                ></v-select>
                <v-text-field label="搜尋" v-model="python_filter_v.search" />
            </div>

            <div class="py-2 close" @click="hide">
                <span class="mdi mdi-unfold-more-horizontal"></span>
            </div>
        </div>
        <div class="main">
            <div v-if="project === 'backend'">
                <div v-for="(log, index) in backend_log_list" :keys="index" class="mb-4">
                    <div class="flex-wrap d-flex" :style="`color:red`">
                        <p class="mr-4 text-green">{{ log.time }}</p>
                        <p class="mr-4 text-green">{{ log.module }}</p>
                        <p :style="`color:${log.color}`">{{ log.level }}</p>
                    </div>
                    <p class="mt-1">{{ log.message }}</p>
                </div>
            </div>
            <div v-if="project === 'chat'">
                <div v-for="(log, index) in chat_log_list" :keys="index" class="mb-4">
                    <div class="flex-wrap d-flex" :style="`color:red`">
                        <p class="mr-4 text-green">{{ log.time }}</p>
                        <p class="mr-4 text-green">{{ log.module }}</p>
                        <p :style="`color:${log.color}`">{{ log.level }}</p>
                    </div>
                    <p class="mt-1">{{ log.message }}</p>
                </div>
            </div>
            <div v-if="project === 'sql'">
                <div
                    v-for="(log, index) in node_log_list"
                    :keys="index"
                    class="mb-4"
                    :class="[log.status === 'success' ? 'success' : 'error']"
                >
                    <p class="mr-4 text-green">{{ log.time }}</p>
                    <p class="mt-1">{{ log.message }}</p>
                    <p class="text-white">{{ log.sql }}</p>
                </div>
            </div>
            <div v-if="project === 'python'">
                <div v-for="(log, index) in python_log_list" :keys="index" class="mb-4">
                    <div class="flex-wrap d-flex" :style="`color:red`">
                        <p class="mr-4 text-green">{{ log.timestamp }}</p>
                        <p class="mr-4 text-green">{{ log.module }}</p>
                        <p :style="`color:${log.color}`">{{ log.level }}</p>
                    </div>
                    <p class="mt-1">{{ log.message }}</p>
                </div>
            </div>

            <!-- <div v-if="project === 'docker'">
                <p>{{ docker_log }}</p>
            </div> -->
        </div>
    </div>
</template>

<style lang="scss" scoped>
.log_view {
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    z-index: 1;

    .header {
        background-color: white;
        overflow-y: hidden;
        height: 20rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        transition: 0.3s;

        .filter1 {
            display: flex;
            width: 100%;
            align-items: center;

            input {
                padding: 0.5rem;
                border-radius: 0.5rem;
                border: 2px solid gray;
            }
        }

        .close {
            background-color: black;
            color: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            position: sticky;
            bottom: 0;
            height: 2rem;
            font-size: 1.5rem;
            transition: 0.3s;

            span {
                transform: scaleX(1.5);
            }

            &:hover {
                background-color: rgba($color: #000000, $alpha: 0.8);
            }
        }
    }

    .hide {
        height: 2rem;
    }

    .main {
        padding: 1rem;
        width: 100%;
        height: 100%;
        background-color: black;
        overflow-y: auto;

        p {
            color: white;
        }

        .mt-1 {
            user-select: text;
        }

        .success {
            p {
                color: green;
            }
        }

        .error {
            p {
                color: #dd0000;
            }
        }
    }
}
</style>
