const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class CronTask extends Model {}

CronTask.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true,
        },
        task_name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            comment: "任務名稱",
        },
        function_name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            comment: "要執行的函數名稱",
        },
        interval: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: "執行間隔（秒）",
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            comment: "任務是否啟用",
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
        modelName: "CronTask",
        tableName: "cron_tasks",
        underscored: true,
        createdAt: "create_time",
        updatedAt: "update_time",
        comment: "定時任務表",
    }
);

module.exports = CronTask;
