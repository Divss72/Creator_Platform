const { DataTypes, Model } = require('sequelize');

class Comment extends Model {}

module.exports = (sequelize) => {
  Comment.init(
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
      body: {
        type: DataTypes.TEXT,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: 'Comment',
      tableName: 'comments',
      underscored: true
    }
  );

  return Comment;
};
