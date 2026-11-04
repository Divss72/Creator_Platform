const { DataTypes, Model } = require('sequelize');

class Content extends Model {}

module.exports = (sequelize) => {
  Content.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
      },
      creatorId: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        field: 'creator_id'
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      body: {
        type: DataTypes.TEXT('long'),
        allowNull: false
      },
      minTierId: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        field: 'min_tier_id'
      }
    },
    {
      sequelize,
      modelName: 'Content',
      tableName: 'content',
      underscored: true
    }
  );

  return Content;
};
