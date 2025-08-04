const { Model, DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../sequelize");
const FormConfiguration = require("./form_configuration");
const Datasets = require("./datasets");
const UploadDocuments = require("./upload_documents");

class FormBindingAssociation extends Model {}

FormBindingAssociation.init(
    {
        id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
        },
        form_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        dataset_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        document_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        binding_type: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            comment:"1:dataset綁定 2:document綁定"
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
        modelName: "FormBindingAssociation",
        tableName: "form_binding_association",
        createdAt: "create_time",
        updatedAt: "update_time",
        underscored: true,
        comment: "表單綁定表",
    }
);

UploadDocuments.belongsToMany(FormConfiguration, {
    through: FormBindingAssociation,
    foreignKey: "document_id", // 明確指定外鍵
    otherKey: "form_id",
});
FormConfiguration.belongsToMany(UploadDocuments, {
    through: FormBindingAssociation,
    foreignKey: "form_id", // 明確指定外鍵
    otherKey: "document_id",
});

FormBindingAssociation.belongsTo(Datasets, { foreignKey: "dataset_id" });

module.exports = FormBindingAssociation;
