const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

const Users = require("../schema/users");
class RecommendCustom extends Model {}
RecommendCustom.init(
    {
        users_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            onDelete: "CASCADE",
        },
        text: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: "提示詞",
        },
        sort: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: "順序",
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
        modelName: "RecommendCustom",
        tableName: "recommend_custom",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "自訂提示詞",
        indexes: [{ unique: false, fields: ["users_id"] }],
    }
);
RecommendCustom.belongsTo(Users, { foreignKey: "users_id" });
module.exports = RecommendCustom;
