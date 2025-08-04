const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const UserType = require("./user_type");

class Users extends Model {}

Users.init(
    {
        id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
        },
        user_type_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            comment: "使用者類別",
        },
        account: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        password: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        is_enable: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 1,
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        avatar: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        department_id: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        sex: {
            type: DataTypes.SMALLINT,
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
        modelName: "Users",
        tableName: "users",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "使用者",
    }
);

Users.belongsTo(UserType, { foreignKey: "user_type_id" });

(async () => {
    // const logintypes = [{ type_name: "中鋼sso" }, { type_name: "遊客登入" }];
    // await UserLoginType.bulkCreate(logintypes);
    // const users = [{id:'3b78c6be-3769-43a7-be1a-f01e9f79a80c',user_type_id:1}]
    // await Users.bulkCreate(users);
    // let rs = await Users.findAll({
    //     include:{
    //         model:UserLoginType,
    //         as:'user_login_type',
    //     }
    // })
    // console.log(rs[0]);
    // console.log(rs[0].user_login_type);
})();

module.exports = Users;
