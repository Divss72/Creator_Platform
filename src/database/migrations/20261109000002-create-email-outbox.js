'use strict';

/**
 * Migration: Create email_outbox table.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('email_outbox', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      type: {
        type: Sequelize.ENUM('welcome', 'new_post', 'weekly_digest'),
        allowNull: false
      },
      user_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      to_email: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      subject: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      html: {
        type: Sequelize.TEXT('medium'),
        allowNull: false
      },
      text: {
        type: Sequelize.TEXT('medium'),
        allowNull: false
      },
      meta: {
        type: Sequelize.JSON,
        allowNull: true
      },
      dedupe_key: {
        type: Sequelize.STRING(190),
        allowNull: false,
        unique: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'sending', 'sent', 'failed', 'skipped'),
        allowNull: false,
        defaultValue: 'pending'
      },
      attempts: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0
      },
      next_attempt_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      last_error: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      skip_reason: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('email_outbox', ['status', 'next_attempt_at'], {
      name: 'idx_email_outbox_status_next'
    });

    await queryInterface.addIndex('email_outbox', ['user_id', 'created_at'], {
      name: 'idx_email_outbox_user_created'
    });

    await queryInterface.addIndex('email_outbox', ['created_at'], {
      name: 'idx_email_outbox_created_at'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('email_outbox');
  }
};
