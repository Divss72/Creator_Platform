'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. subscription_events
    await queryInterface.createTable('subscription_events', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      subscriber_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      creator_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      event: {
        type: Sequelize.ENUM('created', 'tier_changed', 'reactivated', 'cancelled'),
        allowNull: false
      },
      from_tier_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'tiers', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      to_tier_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'tiers', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('subscription_events', ['creator_id', 'created_at'], {
      name: 'idx_subscription_events_creator_created'
    });
    await queryInterface.addIndex('subscription_events', ['subscriber_id'], {
      name: 'idx_subscription_events_subscriber'
    });

    // 2. creator_daily_stats
    await queryInterface.createTable('creator_daily_stats', {
      creator_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      day: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      active_subscribers: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      free_subscribers: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      pro_subscribers: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      vip_subscribers: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      mrr_cents: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      new_subscribers: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      cancellations: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
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
      },
      likes: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      comments: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      }
    });

    await queryInterface.addConstraint('creator_daily_stats', {
      fields: ['creator_id', 'day'],
      type: 'primary key',
      name: 'pk_creator_daily_stats'
    });

    // 3. content_trending
    await queryInterface.createTable('content_trending', {
      content_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
        references: { model: 'content', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      score: {
        type: Sequelize.DOUBLE,
        allowNull: false,
        defaultValue: 0
      },
      rank_position: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      computed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('content_trending', ['rank_position'], {
      name: 'idx_content_trending_rank'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('content_trending');
    await queryInterface.dropTable('creator_daily_stats');
    await queryInterface.dropTable('subscription_events');
  }
};
