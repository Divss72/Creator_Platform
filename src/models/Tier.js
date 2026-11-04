const { DataTypes, Model } = require('sequelize');

class Tier extends Model {}

module.exports = (sequelize) => {
  Tier.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      rank: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      priceCents: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'price_cents'
      }
    },
    {
      sequelize,
      modelName: 'Tier',
      tableName: 'tiers',
      underscored: true
    }
  );

  return Tier;
};
