const { DataTypes, Model } = require('sequelize');

class CreatorProfile extends Model {}

module.exports = (sequelize) => {
  CreatorProfile.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
      },
      userId: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        unique: true,
        field: 'user_id'
      },
      displayName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'display_name'
      },
      bio: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      avatarUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'avatar_url'
      }
    },
    {
      sequelize,
      modelName: 'CreatorProfile',
      tableName: 'creator_profiles',
      underscored: true
    }
  );

  return CreatorProfile;
};
