'use strict';

const { DataTypes, Model } = require('sequelize');

class ContentTrending extends Model {}

module.exports = (sequelize) => {
  ContentTrending.init(
    {
      contentId: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        allowNull: false,
        field: 'content_id'
      },
      score: {
        type: DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 0
      },
      rankPosition: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'rank_position'
      },
      computedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'computed_at',
        defaultValue: DataTypes.NOW
      }
    },
    {
      sequelize,
      modelName: 'ContentTrending',
      tableName: 'content_trending',
      underscored: true,
      timestamps: false
    }
  );

  return ContentTrending;
};
