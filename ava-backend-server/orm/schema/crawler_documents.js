const { Sequelize, Model, DataTypes } = require("sequelize");
const sequelize = require("../sequelize");
const CrawlerSynchronize = require("../schema/crawler_synchronize");

class CrawlerDocuments extends Model {}

CrawlerDocuments.init(
    {
        id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
        },
        filename: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: "文件名",
        },
        date: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            comment: "當日",
        },
        is_enable: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 1,
            comment: "默認啟用",
        },
        crawler_synchronize_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            comment: "關聯同步表",
        },
        training_state: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 0,
            comment: `訓練狀態
            0:上傳失敗
            1:上傳成功
            2:建索引中
            3:建立成功
            4:禁用
            5:已刪除
            6:已至垃圾桶
            7:正在執行中
            8:爬蟲無資料
            97:系統錯誤
            98:爬蟲錯誤
            99:檔案毀損`,
        },
        create_time: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        update_time: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
    },
    {
        sequelize,
        modelName: "CrawlerDocuments",
        tableName: "crawler_documents",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "爬蟲文件表",
    }
);

CrawlerDocuments.belongsTo(CrawlerSynchronize, { foreignKey: "crawler_synchronize_id" });

module.exports = CrawlerDocuments;
