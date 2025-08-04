const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class ChatTheme extends Model {}

ChatTheme.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true,
            comment: "主題名稱",
        },
        is_system: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: "是否為系統預設主題",
        },
        colors: {
            type: DataTypes.JSONB,
            allowNull: false,
            comment: "主題顏色配置",
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
        remark: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: "ChatTheme",
        tableName: "chat_themes",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "聊天室主題配置",
    }
);

module.exports = ChatTheme;
