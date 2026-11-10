'use strict';

const { DataTypes, Model } = require('sequelize');

class ContentDailyStats extends Model {}

module.exports = (sequelize) => {
  ContentDailyStats.init(
    {
      contentId: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        allowNull: false,
        field: 'content_id'
      },
      day: {
        type: DataTypes.DATEONLY,
        primaryKey: true,
        allowNull: false
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
      }
    },
    {
      sequelize,
      modelName: 'ContentDailyStats',
      tableName: 'content_daily_stats',
      underscored: true,
      timestamps: false
    }
  );

  return ContentDailyStats;
};
