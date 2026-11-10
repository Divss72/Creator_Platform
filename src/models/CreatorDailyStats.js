'use strict';

const { DataTypes, Model } = require('sequelize');

class CreatorDailyStats extends Model {}

module.exports = (sequelize) => {
  CreatorDailyStats.init(
    {
      creatorId: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        allowNull: false,
        field: 'creator_id'
      },
      day: {
        type: DataTypes.DATEONLY,
        primaryKey: true,
        allowNull: false
      },
      activeSubscribers: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'active_subscribers'
      },
      freeSubscribers: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'free_subscribers'
      },
      proSubscribers: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'pro_subscribers'
      },
      vipSubscribers: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'vip_subscribers'
      },
      mrrCents: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'mrr_cents'
      },
      newSubscribers: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'new_subscribers'
      },
      cancellations: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      views: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      lockedViews: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'locked_views'
      },
      likes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      comments: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      }
    },
    {
      sequelize,
      modelName: 'CreatorDailyStats',
      tableName: 'creator_daily_stats',
      underscored: true,
      timestamps: false
    }
  );

  return CreatorDailyStats;
};
