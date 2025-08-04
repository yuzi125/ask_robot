const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
class DocumentImageStore extends Model {}

DocumentImageStore.init(
    {
        upload_document_id: {
            type: DataTypes.STRING(50),
            primaryKey: true,
        },
        image_uuid: {
            type: DataTypes.STRING(50),
            primaryKey: true,
        },
        image_data: {
            type: DataTypes.BLOB,
            allowNull: false,
        },
        download_path: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        content_type: {
            type: DataTypes.STRING,
            allowNull: false,
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
            onUpdate: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
    },
    {
        sequelize, // 傳入 Sequelize 實例
        modelName: "DocumentImageStore", // 模型名稱
        tableName: "document_image_store", // 資料庫中的表名
        createdAt: "create_time", // 映射 createdAt 到 create_time
        updatedAt: "update_time",
        underscored: true, // 使用下劃線命名法
    }
);

module.exports = DocumentImageStore;
