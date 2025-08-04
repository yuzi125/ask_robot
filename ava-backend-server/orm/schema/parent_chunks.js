const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
class ParentChunks extends Model {}

ParentChunks.init(
    {
        id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        page_content: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        meta_data: {
            type: DataTypes.JSONB,
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
    },
    {
        sequelize,
        modelName: "ParentChunks",
        tableName: "parent_chunks",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        timestamps: false,
    }
);

module.exports = ParentChunks;
