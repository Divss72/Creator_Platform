const { DataTypes, Model } = require('sequelize');

class Subscription extends Model {}

module.exports = (sequelize) => {
  Subscription.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
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
      tierId: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        field: 'tier_id'
      },
      status: {
        type: DataTypes.ENUM('active', 'cancelled', 'expired'),
        allowNull: false,
        defaultValue: 'active'
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'started_at'
      },
      endsAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'ends_at'
      }
    },
    {
      sequelize,
      modelName: 'Subscription',
      tableName: 'subscriptions',
      underscored: true
    }
  );

  return Subscription;
};
