'use strict';

const { DataTypes, Model } = require('sequelize');

class SubscriptionEvent extends Model {}

module.exports = (sequelize) => {
  SubscriptionEvent.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
      },
      subscriberId: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        field: 'subscriber_id'
      },
      creatorId: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        field: 'creator_id'
      },
      event: {
        type: DataTypes.ENUM('created', 'tier_changed', 'reactivated', 'cancelled'),
        allowNull: false
      },
      fromTierId: {
        type: DataTypes.CHAR(36),
        allowNull: true,
        field: 'from_tier_id'
      },
      toTierId: {
        type: DataTypes.CHAR(36),
        allowNull: true,
        field: 'to_tier_id'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
        defaultValue: DataTypes.NOW
      }
    },
    {
      sequelize,
      modelName: 'SubscriptionEvent',
      tableName: 'subscription_events',
      underscored: true,
      updatedAt: false
    }
  );

  return SubscriptionEvent;
};
