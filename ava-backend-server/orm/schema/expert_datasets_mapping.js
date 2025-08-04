const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Expert = require("../schema/expert");
const Datasets = require("../schema/datasets");
class ExpertDatasetsMapping extends Model {}

ExpertDatasetsMapping.init(
    {
        expert_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "專家id",
            onDelete: "CASCADE",
        },
        datasets_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "知識庫id",
            onDelete: "CASCADE",
        },
        create_time: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
    },
    {
        sequelize,
        modelName: "ExpertDatasetsMapping",
        tableName: "expert_datasets_mapping",
        createdAt: "create_time",
        updatedAt: false,
        underscored: true,
        comment: "專家與知識庫映射表",
    }
);
Datasets.belongsToMany(Expert, { 
    through: ExpertDatasetsMapping,
    foreignKey: 'datasets_id', // 明確指定外鍵
    otherKey: 'expert_id'
});
Expert.belongsToMany(Datasets, { 
    through: ExpertDatasetsMapping,
    foreignKey: 'expert_id', // 明確指定外鍵
    otherKey: 'datasets_id'
});

module.exports = ExpertDatasetsMapping;
