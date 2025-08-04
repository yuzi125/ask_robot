const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const CrawlerAttachmentSynchronize = require("./crawler_attachment_synchronize");

class CrawlerAttachment extends Model {}

CrawlerAttachment.init(
    {
        id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
            comment: "UUID主鍵",
        },
        crawler_synchronize_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            comment: "關聯同步表",
        },
        upload_folder_id: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: "知識庫資料夾名稱",
        },
        page_title: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "頁面標題 (對應 json 的 title)",
        },
        page_url: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "附件來自於哪個頁面 (對應 json 的 url)",
        },
        filename: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "檔案名稱 (已經被爬蟲下載下來的檔案名稱)",
        },
        attachment_link_title: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "附件下載連結顯示的文字 (對應 json 的 attachment title)",
        },
        attachment_link_text: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "附件下載連結顯示的文字 (對應 json 的 attachment text)",
        },
        attachment_href: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "原始附件下載連結 (對應 json 的 attachment href)",
        },
        file_extension: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: "檔案附檔名",
        },
        file_mime_type: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: "檔案MIME類型",
        },
        url: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "檔案附件指向路徑(ava-backend-server)",
        },
        hash: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: "檔案的MD5雜湊值",
        },
        is_enable: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 1,
            comment: "是否啟用",
        },
        training_state: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 0,
            comment: "訓練狀態",
        },
        delete_attempts: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 0,
            comment: "紀錄該筆資料已標記刪除的次數，當達到 x 次時(程式自行設定)，才會真正刪除",
        },
        meta_data: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: "附加資料",
        },
        parent_id: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: "附件的 parent id",
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
        modelName: "CrawlerAttachment",
        tableName: "crawler_attachment",
        createdAt: "create_time",
        updatedAt: "update_time",
        comment: "爬蟲附件資料表",
        underscored: true,
        hooks: {
            afterSync: async (options) => {
                // 建立個別欄位的 GIN 索引
                await sequelize.query(`
                    CREATE INDEX IF NOT EXISTS idx_crawler_attachment_page_title_gin
                    ON crawler_attachment
                    USING GIN (to_tsvector('simple', COALESCE(page_title, '')))
                `);

                await sequelize.query(`
                    CREATE INDEX IF NOT EXISTS idx_crawler_attachment_link_text_gin
                    ON crawler_attachment
                    USING GIN (to_tsvector('simple', COALESCE(attachment_link_text, '')))
                `);

                // 建立組合索引 (帶權重的)
                await sequelize.query(`
                    CREATE INDEX IF NOT EXISTS idx_crawler_attachment_combined_search
                    ON crawler_attachment
                    USING GIN (
                        (
                            setweight(to_tsvector('simple', COALESCE(page_title, '')), 'A') ||
                            setweight(to_tsvector('simple', COALESCE(attachment_link_text, '')), 'C')
                        )
                    )
                `);

                // 常用的排序或過濾條件的普通索引
                await sequelize.query(`
                    CREATE INDEX IF NOT EXISTS idx_crawler_attachment_training_state
                    ON crawler_attachment (training_state)
                `);
            },
        },
    }
);

CrawlerAttachment.belongsTo(CrawlerAttachmentSynchronize, { foreignKey: "crawler_synchronize_id" });

module.exports = CrawlerAttachment;
