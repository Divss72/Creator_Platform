'use strict';

const { DataTypes, Model } = require('sequelize');

class EmailOutbox extends Model {}

module.exports = (sequelize) => {
  EmailOutbox.init(
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      type: {
        type: DataTypes.ENUM('welcome', 'new_post', 'weekly_digest'),
        allowNull: false
      },
      userId: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        field: 'user_id'
      },
      toEmail: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'to_email'
      },
      subject: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      html: {
        type: DataTypes.TEXT('medium'),
        allowNull: false
      },
      text: {
        type: DataTypes.TEXT('medium'),
        allowNull: false
      },
      meta: {
        type: DataTypes.JSON,
        allowNull: true
      },
      dedupeKey: {
        type: DataTypes.STRING(190),
        allowNull: false,
        unique: true,
        field: 'dedupe_key'
      },
      status: {
        type: DataTypes.ENUM('pending', 'sending', 'sent', 'failed', 'skipped'),
        allowNull: false,
        defaultValue: 'pending'
      },
      attempts: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0
      },
      nextAttemptAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'next_attempt_at'
      },
      lastError: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'last_error'
      },
      skipReason: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'skip_reason'
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'sent_at'
      }
    },
    {
      sequelize,
      modelName: 'EmailOutbox',
      tableName: 'email_outbox',
      underscored: true
    }
  );

  return EmailOutbox;
};

