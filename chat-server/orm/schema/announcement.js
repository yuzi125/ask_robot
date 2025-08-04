// models/Announcement.js
const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class Announcement extends Model {}

Announcement.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        title: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: "公告標題",
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: "公告內容",
        },
        type: {
            type: DataTypes.ENUM("TERMS", "NOTICE"),
            allowNull: false,
            defaultValue: "NOTICE",
            comment: "公告類型：TERMS-條款, NOTICE-一般公告",
        },
        version: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: "1.0",
            comment: "公告版本",
        },
        require_agreement: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: "是否需要使用者同意",
        },
        status: {
            type: DataTypes.ENUM("DRAFT", "PUBLISHED", "ARCHIVED"),
            allowNull: false,
            defaultValue: "DRAFT",
            comment: "公告狀態",
        },
        use_markdown: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: "是否使用 Markdown 格式",
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
        modelName: "Announcement",
        tableName: "announcements",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "公告訊息設定",
    }
);

module.exports = Announcement;
