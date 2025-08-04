const { DataTypes, Model, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class Expert extends Model {}
Expert.init(
    {
        id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
            comment: "專家ID",
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            comment: "專家名稱",
        },
        welcome: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "歡迎詞",
        },
        avatar: {
            type: DataTypes.STRING(1000),
            allowNull: true,
            comment: "頭像",
        },
        source_chunk_mode: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "來源 chunk 顯示的模式 完整(full) 簡易(simple)",
        },
        url: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: "專家url",
        },
        popular_tags: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "熱門標籤",
            defaultValue: "[]",
        },
        config_jsonb: {
            type: DataTypes.JSONB,
            allowNull: true,
            comment: "prompt設定",
        },
        is_enable: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
        },
        state: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        permission: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 0,
            comment: `0:須查看user權限
            1:公開`,
        },
        prompt: {
            type: DataTypes.STRING(5000),
            allowNull: true,
        },
        sort_order: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: "排序",
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
        created_by: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: "創建者",
        },
        updated_by: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: "更新者",
        },
    },
    {
        sequelize,
        modelName: "Expert",
        tableName: "expert",
        createdAt: "create_time",
        updatedAt: "update_time",
        comment: "專家表",
        underscored: true,
    }
);

module.exports = Expert;
