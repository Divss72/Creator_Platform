'use strict';

const { DataTypes, Model } = require('sequelize');

class Media extends Model {}

module.exports = (sequelize) => {
  Media.init(
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
      creatorId: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        field: 'creator_id'
      },
      kind: {
        type: DataTypes.ENUM('image', 'video'),
        allowNull: false
      },
      publicId: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        field: 'public_id'
      },
      format: {
        type: DataTypes.STRING(32),
        allowNull: false
      },
      bytes: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      width: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
      },
      height: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true
      },
      durationSeconds: {
        type: DataTypes.FLOAT,
        allowNull: true,
        field: 'duration_seconds'
      },
      originalName: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: 'original_name'
      },
      position: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: 'Media',
      tableName: 'media',
      underscored: true
    }
  );

  return Media;
};
