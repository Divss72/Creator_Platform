'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('content', {
      id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false
      },
      creator_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      body: {
        type: Sequelize.TEXT('long'),
        allowNull: false
      },
      min_tier_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: {
          model: 'tiers',
          key: 'id'
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Add required indexes: (creator_id, created_at), (min_tier_id)
    await queryInterface.addIndex('content', ['creator_id', 'created_at'], {
      name: 'idx_content_creator_created_at'
    });

    await queryInterface.addIndex('content', ['min_tier_id'], {
      name: 'idx_content_min_tier_id'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('content');
  }
};
