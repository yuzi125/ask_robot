const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const UploadFolder = require("../schema/upload_folder");
class UploadDocuments extends Model {}

UploadDocuments.init(
    {
        id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
        },
        filename: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: "存檔名",
        },
        originalname: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: "原始名",
        },
        is_enable: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
            comment: "是否啟用",
        },
        training_state: {
            type: DataTypes.INTEGER,
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
            8:排程正在執行刪除中
            97:系統錯誤
            98:爬蟲錯誤
            99:檔案毀損`,
        },
        document_type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: "document",
            comment: "文件類型",
        },
        upload_folder_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        datasets_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        datasource_url: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        datasource_name: {
            type: DataTypes.STRING(50),
            allowNull: true,
        },
        separator: {
            type: DataTypes.STRING(50),
            allowNull: true,
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
        expiration_time: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: "文件過期時間 (UTC)",
        },
        created_by: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: "創建者",
        },
        updated_by: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: "更新者",
        },
    },
    {
        sequelize,
        modelName: "UploadDocuments",
        tableName: "upload_documents",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "資料集檔案",
        indexes: [{ name: "upload_documents_datasets_id_idx", fields: ["datasets_id"] }],
    }
);
UploadDocuments.belongsTo(UploadFolder, { foreignKey: "upload_folder_id" });
module.exports = UploadDocuments;
