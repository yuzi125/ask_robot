const responseModel = require("../../model/responseModel");
let { redisClient } = require("../../global/redisStore");
let { pool } = require("../../db/pgsql.js");

const checkRedisConnect = async () => {
    let redis;

    try {
        // 使用 ping 測試 Redis 是否可用
        const pong = await redisClient.ping();
        console.log("pong", pong);
        if (pong === "PONG") {
            redis = { connect: true };
        } else {
            redis = { connect: false, "error-message": "redis 連接失敗" };
        }
    } catch (error) {
        redis = { connect: false, "error-message": error.message };
    }

    return redis;
};

const checkDbConnect = async () => {
    let db;

    try {
        var client = await pool.connect();
        await client.query("SELECT 1");
        db = { connect: true };
    } catch (error) {
        db = { connect: false, "error-message": error.message };
    } finally {
        client.release();
    }

    return db;
};

exports.serverHealthCheckList = async (req, res) => {
    let rsmodel = new responseModel();

    try {
        var redis = await checkRedisConnect();
        var db = await checkDbConnect();
        console.log("db", db);

        rsmodel.code = 0;
        rsmodel.message = "ok";
        rsmodel.data = { redis, db };
    } catch (error) {
        rsmodel.code = 1;
        rsmodel.message = error.message;
        rsmodel.data = { redis, db };
    }
    res.json(rsmodel);
};

exports.serverHealthRedisCheck = async (req, res) => {
    let rsmodel = new responseModel();

    try {
        var redis = await checkRedisConnect();

        rsmodel.code = 0;
        rsmodel.data = { redis };
    } catch (error) {
        rsmodel.code = 1;
        rsmodel["error-message"] = error.message;
        rsmodel.data = { redis };
    }
    res.json(rsmodel);
};

exports.serverHealthDbCheck = async (req, res) => {
    let rsmodel = new responseModel();

    try {
        var db = await checkDbConnect();

        rsmodel.code = 0;
        rsmodel.data = { db };
    } catch (error) {
        rsmodel.code = 1;
        rsmodel["error-message"] = error.message;
        rsmodel.data = { db };
    }
    res.json(rsmodel);
};
