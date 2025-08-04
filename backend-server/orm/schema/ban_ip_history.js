const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");

class BanIpHistory extends Model {}

BanIpHistory.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
        },
        ip: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },        
        device: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        status: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "封鎖狀態",
        },
        type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "何種方式封鎖",
        },
        operator: {
            type: DataTypes.STRING(100),
            allowNull: false,
            comment: "當下封鎖別人的操作者",
        },     
        action: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "操作行為",
        },                   
        expired_time: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            comment: "解鎖時間",
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
        modelName: "BanIpHistory",
        tableName: "ban_ip_history",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "IP被鎖定的歷史名單",
    }
);

module.exports = BanIpHistory;
