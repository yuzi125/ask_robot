const axios = require("axios");
const responseModel = require("../../model/responseModel");
const Settings = require("../../orm/schema/settings");
const PROMETHEUS_URL = process.env.PROMETHEUS_URL || "http://prometheus:9090";

exports.getPrometheusUrl = async function (req, res) {
    const rsmodel = new responseModel();
    const prometheusUrl = await Settings.findOne({
        where: {
            key: "prometheus_url",
        },
    });

    rsmodel.code = 0;
    rsmodel.data = JSON.parse(prometheusUrl.value);
    res.json(rsmodel);
};

exports.getInstancesAndJobs = async function (req, res) {
    const rsmodel = new responseModel();
    try {
        const { prometheusUrl } = req.query;
        const response = await axios.get(`${prometheusUrl}/api/v1/targets`);

        const activeTargets = response.data.data.activeTargets.map((target) => ({
            instance: target.labels.instance,
            job: target.labels.job,
        }));

        rsmodel.code = 0;
        rsmodel.data = activeTargets;
    } catch (error) {
        console.error("Error fetching instances and jobs:", error.message);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.getQuickCPUMemDisk = async function (req, res) {
    const rsmodel = new responseModel();
    const { instance, job, prometheusUrl } = req.query;

    // instance 和 job 會同時存在，直接組合成標籤選擇器
    const labelSelector = `,instance="${instance}",job="${job}"`;

    const queries = {
        cpuUsage: `100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"${labelSelector}}[5m])))`,
        sysLoad: `scalar(node_load1{${labelSelector.slice(
            1
        )}}) * 100 / count(count(node_cpu_seconds_total{${labelSelector.slice(1)}}) by (cpu))`,
        ramUsed: `(1 - (node_memory_MemAvailable_bytes{${labelSelector.slice(
            1
        )}} / node_memory_MemTotal_bytes{${labelSelector.slice(1)}})) * 100`,
        swapUsed: `((node_memory_SwapTotal_bytes{${labelSelector.slice(
            1
        )}} - node_memory_SwapFree_bytes{${labelSelector.slice(
            1
        )}}) / (node_memory_SwapTotal_bytes{${labelSelector.slice(1)}})) * 100`,
        rootFSUsed: `100 - ((node_filesystem_avail_bytes{mountpoint="/",fstype!="rootfs"${labelSelector}} * 100) / node_filesystem_size_bytes{mountpoint="/",fstype!="rootfs"${labelSelector}})`,
        rootFSTotal: `node_filesystem_size_bytes{mountpoint="/",fstype!="rootfs"${labelSelector}}`,
        cpuCores: `count(count(node_cpu_seconds_total{${labelSelector.slice(1)}}) by (cpu))`,
        ramTotal: `node_memory_MemTotal_bytes{${labelSelector.slice(1)}}`,
        swapTotal: `node_memory_SwapTotal_bytes{${labelSelector.slice(1)}}`,
        uptime: `node_time_seconds{${labelSelector.slice(1)}} - node_boot_time_seconds{${labelSelector.slice(1)}}`,
    };

    try {
        const resultsData = {};
        const promises = Object.entries(queries).map(async ([key, query]) => {
            const response = await axios.get(`${prometheusUrl}/api/v1/query`, { params: { query } });
            resultsData[key] = response.data.data.result.map(({ metric, value }) => ({
                metric,
                time: new Date(value[0] * 1000).toLocaleString(),
                value: parseFloat(value[1]),
            }));
        });

        await Promise.all(promises);
        rsmodel.code = 0;
        rsmodel.data = resultsData;
    } catch (error) {
        console.error("Error fetching metrics:", error.message);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }
    res.json(rsmodel);
};

exports.getPerformanceMetrics = async function (req, res) {
    const rsmodel = new responseModel();
    const { instance, job, prometheusUrl } = req.query;
    const labelSelector = `,instance="${instance}",job="${job}"`;

    const queries = {
        tcpConnections: `node_netstat_Tcp_CurrEstab{${labelSelector.slice(1)}}[1h]`,
        fileSystem: `node_filesystem_avail_bytes{device!~'rootfs'${labelSelector}}[24h]`,
    };

    try {
        const resultsData = {};

        const promises = Object.entries(queries).map(async ([key, query]) => {
            const response = await axios.get(`${prometheusUrl}/api/v1/query`, { params: { query } });

            resultsData[key] = response.data.data.result.map((item) => ({
                name: item.metric.mountpoint,
                data: item.values.map(([timestamp, value]) => ({
                    time: timestamp * 1000, // 轉換為毫秒
                    value: parseFloat(value),
                })),
            }));
        });

        await Promise.all(promises);

        rsmodel.code = 0;
        rsmodel.data = resultsData;
        res.json(rsmodel);
    } catch (error) {
        console.error("Error fetching metrics:", error.message);
        rsmodel.code = 1;
        rsmodel.message = error.message;
        res.json(rsmodel);
    }
};

exports.getDiskIO = async function (req, res) {
    const rsmodel = new responseModel();
    const { instance, job, prometheusUrl } = req.query;
    const labelSelector = `,instance="${instance}",job="${job}"`;

    const queries = {
        reads: `irate(node_disk_reads_completed_total{device=~"[a-z]+|nvme[0-9]+n[0-9]+|mmcblk[0-9]+"${labelSelector}}[5m])[1h:1m]`,
        writes: `irate(node_disk_writes_completed_total{device=~"[a-z]+|nvme[0-9]+n[0-9]+|mmcblk[0-9]+"${labelSelector}}[5m])[1h:1m]`,
    };

    try {
        const promises = Object.entries(queries).map(async ([key, query]) => {
            const response = await axios.get(`${prometheusUrl}/api/v1/query`, { params: { query } });

            if (response.data.status !== "success") {
                throw new Error(`Prometheus query failed for ${key}`);
            }

            return {
                type: key,
                data: response.data.data.result,
            };
        });

        const results = await Promise.all(promises);

        // 組織時間序列數據
        const timeseriesData = {
            reads: {},
            writes: {},
        };

        // 處理讀取和寫入的時間序列數據
        results.forEach((result) => {
            result.data.forEach((series) => {
                const deviceName = series.metric.device;
                const values = series.values.map((point) => ({
                    time: point[0] * 1000, // 轉換為毫秒
                    value: parseFloat(point[1]),
                }));

                if (result.type === "reads") {
                    timeseriesData.reads[deviceName] = values;
                } else {
                    timeseriesData.writes[deviceName] = values;
                }
            });
        });

        // 合併所有設備的數據到一個統一的格式
        const devices = [...new Set([...Object.keys(timeseriesData.reads), ...Object.keys(timeseriesData.writes)])];

        // 最終數據結構
        const formattedData = devices.map((device) => ({
            device,
            data: {
                reads: timeseriesData.reads[device] || [],
                writes: timeseriesData.writes[device] || [],
            },
        }));

        rsmodel.code = 0;
        rsmodel.data = formattedData;
    } catch (error) {
        console.error("Error fetching disk IO metrics:", error.message);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }

    res.json(rsmodel);
};

exports.customQuery = async function (req, res) {
    const rsmodel = new responseModel();

    // 從請求中獲取查詢參數
    const { query } = req.query;

    if (!query) {
        rsmodel.code = 1;
        rsmodel.message = "Query parameter is missing.";
        return res.status(400).json(rsmodel);
    }

    try {
        // 發送請求到 Prometheus API
        const response = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
            params: { query },
        });

        if (response.data.status !== "success") {
            throw new Error("Prometheus query failed.");
        }

        // 處理 Prometheus 返回的數據
        const formattedData = response.data.data.result;

        rsmodel.code = 0;
        rsmodel.data = formattedData;
    } catch (error) {
        console.error("Error fetching custom query metrics:", error.message);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }

    res.json(rsmodel);
};

exports.customFullQuery = async function (req, res) {
    const rsmodel = new responseModel();
    const { query, queryType, start, end, prometheusUrl } = JSON.parse(req.body);

    try {
        let response;
        if (queryType === "instant") {
            // 即時查詢
            response = await axios.get(`${prometheusUrl}/api/v1/query`, {
                params: { query },
            });
        } else {
            // 範圍查詢
            response = await axios.get(`${prometheusUrl}/api/v1/query_range`, {
                params: {
                    query,
                    start,
                    end,
                    // 根據時間範圍動態計算 step
                    step: calculateStep(end - start),
                },
            });
        }

        rsmodel.code = 0;
        rsmodel.data = response.data;
    } catch (error) {
        console.error("Error executing custom query:", error);
        rsmodel.code = 1;
        rsmodel.message = error.message;
    }

    res.json(rsmodel);
};

// 根據時間範圍計算合適的步長
function calculateStep(duration) {
    if (duration <= 3600) return "15s"; // 1小時內，15秒一個點
    if (duration <= 86400) return "1m"; // 1天內，1分鐘一個點
    if (duration <= 604800) return "5m"; // 1週內，5分鐘一個點
    if (duration <= 2592000) return "1h"; // 1月內，1小時一個點
    return "1d"; // 超過1月，1天一個點
}
