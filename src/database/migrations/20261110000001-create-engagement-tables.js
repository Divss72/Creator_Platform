'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. content_reactions
    await queryInterface.createTable('content_reactions', {
      id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false
      },
      content_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'content', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      user_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('content_reactions', ['content_id', 'user_id'], {
      unique: true,
      name: 'unique_content_reaction_user'
    });
    await queryInterface.addIndex('content_reactions', ['content_id', 'created_at'], {
      name: 'idx_content_reactions_content_created'
    });

    // 2. content_view_dedupe
    await queryInterface.createTable('content_view_dedupe', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      content_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'content', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      viewer_key: {
        type: Sequelize.CHAR(64),
        allowNull: false
      },
      day: {
        type: Sequelize.DATEONLY,
        allowNull: false
      }
    });

    await queryInterface.addIndex('content_view_dedupe', ['content_id', 'viewer_key', 'day'], {
      unique: true,
      name: 'unique_content_viewer_day'
    });
    await queryInterface.addIndex('content_view_dedupe', ['day'], {
      name: 'idx_content_view_dedupe_day'
    });

    // 3. content_daily_stats
    await queryInterface.createTable('content_daily_stats', {
      content_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'content', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      day: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      views: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      locked_views: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      }
    });

    await queryInterface.addConstraint('content_daily_stats', {
      fields: ['content_id', 'day'],
      type: 'primary key',
      name: 'pk_content_daily_stats'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('content_daily_stats');
    await queryInterface.dropTable('content_view_dedupe');
    await queryInterface.dropTable('content_reactions');
  }
};
