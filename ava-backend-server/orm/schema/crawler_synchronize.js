const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const Datasource = require("../schema/datasource");
class CrawlerSynchronize extends Model {}

CrawlerSynchronize.init(
    {
        id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
            comment: "自增id",
        },
        datasource_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "關聯資料源",
        },
        crawler_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: "還未關聯爬蟲表",
        },
        config_jsonb: {
            type: DataTypes.JSONB,
            comment: "當下同步用的tag等",
        },
        training_state: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 0,
            comment: `訓練狀態
            0:上傳失敗
            1:上傳成功
            2:建索引中
            3:建立成功
            4:禁用
            5:已刪除
            6:已至垃圾桶
            7:正在執行中
            8:爬蟲無資料
            97:系統錯誤
            98:爬蟲錯誤
            99:檔案毀損`,
        },
        added_files_count: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
            comment: "當次新增的檔案數量",
        },
        deleted_files_count: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
            comment: "當次被刪除的檔案數量",
        },
        pending_delete_files_count: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
            comment: "預計被刪除的檔案數量",
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
        modelName: "CrawlerSynchronize",
        tableName: "crawler_synchronize",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "同步表",
    }
);
CrawlerSynchronize.belongsTo(Datasource, { foreignKey: "datasource_id" });
module.exports = CrawlerSynchronize;
