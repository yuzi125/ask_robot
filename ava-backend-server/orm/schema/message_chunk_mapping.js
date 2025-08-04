const { DataTypes, Model, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
class MessageChunkMapping extends Model {}

MessageChunkMapping.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        message_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        dataset_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        chunk_id: {
            type: DataTypes.BIGINT,
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
        modelName: "MessageChunkMapping",
        tableName: "message_chunk_mapping",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "記錄message、dataset、chunk的對應關係",
    }
);

module.exports = MessageChunkMapping;
