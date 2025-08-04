const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize"); // Adjust this import according to your actual database file location

class QAInfo extends Model {}

QAInfo.init(
    {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
        },
        qa_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        type_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        value: {
            type: DataTypes.STRING(500),
            allowNull: false,
        },
        show_key: {
            type: DataTypes.STRING(500),
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
        },
    },
    {
        sequelize,
        modelName: "QAInfo",
        tableName: "qa_info",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
    }
);

module.exports = QAInfo;
