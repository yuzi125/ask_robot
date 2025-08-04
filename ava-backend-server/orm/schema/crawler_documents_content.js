const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const CrawlerDocuments = require("./crawler_documents");
const CrawSynchronize = require("./crawler_synchronize");
const CrawlerDocumentsExtra = require("./crawler_documents_extra");

class CrawlerDocumentsContent extends Model {}

CrawlerDocumentsContent.init(
    {
        id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
        },
        text: {
            type: DataTypes.TEXT,
            allowNull: false,
        },

        title: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        url: {
            type: DataTypes.TEXT,
            allowNull: false,
        },

        html: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: "html 清洗完的內容",
        },
        crawler_documents_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "關聯爬蟲文件",
        },
        crawler_synchronize_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            comment: "關聯同步表 確保知識庫拿到的是自己的 content",
        },
        is_enable: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 1,
            comment: "是否啟用",
        },
        crawler_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "還未關聯爬蟲id",
        },
        meta_data: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: "",
        },
        hash: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "qa的md5值 content 跟 title hash",
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
        content_segmented: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "分詞後的內容",
        },
        delete_attempts: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 0,
            comment: "紀錄該筆資料已標記刪除的次數，當達到 x 次時(程式自行設定)，才會真正刪除",
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
        modelName: "CrawlerDocumentsContent",
        tableName: "crawler_documents_content",
        createdAt: "create_time",
        updatedAt: "update_time",
        comment: "爬到的文件內容",
        underscored: true,
        hooks: {
            afterSync: async (options) => {
                await sequelize.query(`
                    CREATE INDEX IF NOT EXISTS idx_content_segmented
                    ON crawler_documents_content
                    USING gin (to_tsvector('simple', content_segmented))
                `);

                await sequelize.query(`
                    CREATE INDEX IF NOT EXISTS idx_crawler_docs_state_update 
                    ON crawler_documents_content (training_state, update_time)
                    WHERE training_state = 6;
                `);
            },
        },
    }
);

CrawlerDocumentsContent.belongsTo(CrawlerDocuments, { foreignKey: "crawler_documents_id" });
CrawlerDocumentsContent.belongsTo(CrawSynchronize, { foreignKey: "crawler_synchronize_id" });
CrawlerDocumentsContent.hasMany(CrawlerDocumentsExtra, {
    foreignKey: "crawler_documents_id",
    sourceKey: "crawler_documents_id",
    as: "CrawlerDocumentsExtras", // 關聯的別名
});
CrawlerDocumentsExtra.belongsTo(CrawlerDocumentsContent, {
    foreignKey: "crawler_documents_id",
    targetKey: "crawler_documents_id",
    as: "CrawlerDocumentsContent", // 可選，主要是反向關聯的別名
});

module.exports = CrawlerDocumentsContent;
