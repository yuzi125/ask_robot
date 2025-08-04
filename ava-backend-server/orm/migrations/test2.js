module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.changeColumn("TargetTable", "ForeignKeyColumn", {
            type: Sequelize.INTEGER,
            allowNull: false, // 設定為非空
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.changeColumn("TargetTable", "ForeignKeyColumn", {
            type: Sequelize.INTEGER,
            allowNull: true, // 還原為允許空值
        });
    },
};
