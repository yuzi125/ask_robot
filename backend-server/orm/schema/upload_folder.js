const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Datasource = require("../schema/datasource");
class UploadFolder extends Model {}

UploadFolder.init(
    {
        id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
        },
        datasource_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "數據源id",
            onDelete: "CASCADE",
        },
        name: {
            type: DataTypes.STRING(255),
            comment: "資料夾名稱",
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
        modelName: "UploadFolder",
        tableName: "upload_folder",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "上傳檔案的資料表",
    }
);
UploadFolder.belongsTo(Datasource, { foreignKey: "datasource_id" });
module.exports = UploadFolder;
