// require("../../ava-chat-server/utils/env");
const host = process.env.DB_HOST;
const port = process.env.DB_PORT;
const db_name = process.env.DB_NAME;
const db_user = process.env.DB_USER;
const db_pwd = process.env.DB_PWD;

const { Sequelize } = require("sequelize");
// 创建 Sequelize 实例，连接到数据库
const sequelize = new Sequelize(db_name, db_user, db_pwd, {
    host: host,
    port: port, // 指定你的数据库端口号
    dialect: "postgres", // 指定使用的数据库类型
    logging: false,
    // logging: console.log, // 如果你不想看到 SQL 查询日志，可以将其关闭
});

module.exports = sequelize;
