const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize"); // 您的 Sequelize 實例

class DeploymentRecord extends Model {}

// 初始化 DeploymentRecord 模型
DeploymentRecord.init(
  {
    id: {
      type: DataTypes.INTEGER, // 使用 INTEGER 作為自增 ID
      allowNull: false,
      primaryKey: true,
      autoIncrement: true, // 設定為自增
    },
    commit_sha: {
      type: DataTypes.STRING(40), // 長度設定為 40，因為 SHA-1 的長度是 40
      allowNull: false,
    },
    branch_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    version_name: {
      type: DataTypes.STRING(50), // 新增的 version_name 欄位，長度為 50
      allowNull: true,
      comment: "版本名稱", // 可以根據需要添加注釋
    },
    deployed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"), // 默認值為當前時間
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
      onUpdate: Sequelize.literal("CURRENT_TIMESTAMP") // 在更新時自動設置時間
    },
  },
  {
    sequelize, // 傳入 Sequelize 實例
    modelName: "DeploymentRecord", // 模型名稱
    tableName: "deployment_records", // 資料庫中的表名
    createdAt: "create_time", // 映射 createdAt 到 create_time
    updatedAt: "update_time", // 映射 updatedAt 到 update_time
    underscored: true, // 使用下劃線命名法
  }
);

module.exports = DeploymentRecord;
