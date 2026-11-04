const { DataTypes, Model } = require('sequelize');

class User extends Model {}

module.exports = (sequelize) => {
  User.init(
    {
      id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
      },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'password_hash'
      },
      role: {
        type: DataTypes.ENUM('creator', 'subscriber'),
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      underscored: true
    }
  );

  return User;
};
