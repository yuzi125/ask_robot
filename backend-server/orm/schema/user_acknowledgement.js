// models/UserAcknowledgment.js
const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Announcement = require("./announcement");

class UserAcknowledgment extends Model {}

UserAcknowledgment.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        announcement_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: "公告 ID",
            references: {
                model: "announcements",
                key: "id",
            },
        },
        uid: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "使用者 UID",
        },
        action: {
            type: DataTypes.ENUM("READ", "AGREED"),
            allowNull: false,
            defaultValue: "READ",
            comment: "使用者行為：READ-已讀, AGREED-同意",
        },
        ip_address: {
            type: DataTypes.STRING(45),
            allowNull: true,
            comment: "使用者 IP 地址",
        },
        user_agent: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: "使用者瀏覽器信息",
        },
        create_time: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
    },
    {
        sequelize,
        modelName: "UserAcknowledgment",
        tableName: "user_acknowledgments",
        createdAt: "create_time",
        updatedAt: false,
        underscored: true,
        comment: "使用者公告確認記錄",
        indexes: [
            {
                unique: true,
                fields: ["announcement_id", "uid"],
            },
        ],
    }
);

// 設定關聯
UserAcknowledgment.belongsTo(Announcement, {
    foreignKey: "announcement_id",
    as: "announcement",
});

Announcement.hasMany(UserAcknowledgment, {
    foreignKey: "announcement_id",
    as: "acknowledgments",
});

module.exports = UserAcknowledgment;
