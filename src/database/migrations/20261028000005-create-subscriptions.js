'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('subscriptions', {
      id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false
      },
      subscriber_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
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
      tier_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: {
          model: 'tiers',
          key: 'id'
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      },
      status: {
        type: Sequelize.ENUM('active', 'cancelled', 'expired'),
        allowNull: false,
        defaultValue: 'active'
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      ends_at: {
        type: Sequelize.DATE,
        allowNull: true
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

    // Unique constraint: UNIQUE (subscriber_id, creator_id)
    await queryInterface.addConstraint('subscriptions', {
      fields: ['subscriber_id', 'creator_id'],
      type: 'unique',
      name: 'unique_subscriber_creator'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('subscriptions');
  }
};
