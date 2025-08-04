const { Pool } = require("pg");
require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });

const host = process.env.DB_HOST;
const port = process.env.DB_PORT;
const db_name = process.env.DB_NAME;
const db_user = process.env.DB_USER;
const db_pwd = process.env.DB_PWD;

console.log(`db info: ${db_user}@${host}:${port}/${db_name}`);

const createPool = () => {
    const pool = new Pool({
        user: db_user,
        host: host,
        database: db_name,
        password: db_pwd,
        port: port,
        max: 75,
        connectionTimeoutMillis: 60000,
    });

    pool.on("error", (err, client) => {
        console.error("Unexpected error on idle client", err);
        // Instead of exiting, we'll attempt to reconnect
        setTimeout(reconnect, 5000);
    });

    pool.on("connect", () => {
        console.debug("Connected to PostgreSQL database successfully.");
    });

    return pool;
};

let pool = createPool();

const reconnect = () => {
    console.log("Attempting to reconnect to the database...");
    if (pool) {
        // Close the existing pool
        pool.end().catch((err) => console.error("Error closing pool", err));
    }
    // Create a new pool
    pool = createPool();
    module.exports.pool = pool
};

// Wrapper function to handle potential disconnects
const query = async (text, params) => {
    try {
        return await pool.query(text, params);
    } catch (err) {
        if (err.code === "ECONNREFUSED" || err.code === "ECONNRESET") {
            console.error("Database connection lost. Attempting to reconnect...");
            reconnect();
            throw new Error("Database connection lost. Please retry your query.");
        }
        throw err;
    }
};

// 檢查DB狀況
const checkDBConnection = () => {
    return new Promise((resolve, reject) => {
        if (pool) {
            pool.connect((err, client, release) => {
                if (err) {
                    console.error("DB connection error: ", err.stack);
                    return resolve({ code: 0, message: "DB connection error." });
                }
                // 測試查詢
                client.query("SELECT NOW()", (err, res) => {
                    // 釋放client
                    release();

                    if (err) {
                        console.error("Error executing query.", err.stack);
                        return resolve({ code: 0, message: "Error executing query." });
                    }
                    return resolve({ code: 1, message: `Connection is OK. Server time: ${res.rows[0].now}` });
                });
            });
        } else {
            resolve({ code: 0, message: "Pool does not exist." });
        }
    });
};

module.exports = { query, pool, checkDBConnection };
