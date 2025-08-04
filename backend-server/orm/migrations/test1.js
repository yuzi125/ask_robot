module.exports = {
    up: async (queryInterface, Sequelize) => {
      await queryInterface.addColumn('users', 'ForeignKeyColumn', {
        type: Sequelize.INTEGER,
        allowNull: true, // 初始允許空值
        references: {
          model: 'RelatedTable', // 指定關聯表
          key: 'id', // 指定關聯表的主鍵
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    },
  
    down: async (queryInterface, Sequelize) => {
      await queryInterface.removeColumn('TargetTable', 'ForeignKeyColumn');
    }
  };