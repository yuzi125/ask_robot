const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class UserCompletionHistory extends Model {}

UserCompletionHistory.init(
    {
        id: {
            type: DataTypes.STRING(50),
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "使用者 UID",
        },
        expert_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "專家 ID",
        },
        user_input: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: "使用者輸入",
        },
        expert_output: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: "專家輸出",
        },
        create_time: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            comment: "建立時間",
        },
        update_time: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            comment: "更新時間",
        },
    },
    {
        sequelize,
        modelName: "UserCompletionHistory",
        tableName: "user_completion_history",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "使用者專家對話記錄",
    }
);

module.exports = UserCompletionHistory;
