'use strict';

const { DataTypes, Model } = require('sequelize');

class ContentViewDedupe extends Model {}

module.exports = (sequelize) => {
  ContentViewDedupe.init(
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
      },
      contentId: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        field: 'content_id'
      },
      viewerKey: {
        type: DataTypes.CHAR(64),
        allowNull: false,
        field: 'viewer_key'
      },
      day: {
        type: DataTypes.DATEONLY,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: 'ContentViewDedupe',
      tableName: 'content_view_dedupe',
      underscored: true,
      timestamps: false
    }
  );

  return ContentViewDedupe;
};
