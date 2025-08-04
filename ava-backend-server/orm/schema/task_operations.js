const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class TaskOperation extends Model {}

TaskOperation.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true,
        },
        cronTaskId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: "cron_tasks",
                key: "id",
            },
            comment: "關聯的定時任務ID",
        },
        operation: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "操作類型",
        },
        status: {
            type: DataTypes.ENUM("pending", "processing", "completed", "failed"),
            allowNull: false,
            defaultValue: "pending",
            comment: "操作狀態",
        },
        retryCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: "重試次數",
        },
        params: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: "操作參數",
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
        modelName: "TaskOperation",
        tableName: "task_operations",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "任務操作表",
    }
);

module.exports = TaskOperation;
