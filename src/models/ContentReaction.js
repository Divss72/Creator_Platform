'use strict';

const { DataTypes, Model } = require('sequelize');

class ContentReaction extends Model {}

module.exports = (sequelize) => {
  ContentReaction.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
      },
      contentId: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        field: 'content_id'
      },
      userId: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        field: 'user_id'
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
      modelName: 'ContentReaction',
      tableName: 'content_reactions',
      underscored: true,
      updatedAt: false
    }
  );

  return ContentReaction;
};
