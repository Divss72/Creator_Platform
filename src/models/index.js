const { sequelize } = require('../config/database');

const defineUser = require('./User');
const defineCreatorProfile = require('./CreatorProfile');
const defineTier = require('./Tier');
const defineContent = require('./Content');
const defineSubscription = require('./Subscription');
const defineComment = require('./Comment');

// Initialize models
const User = defineUser(sequelize);
const CreatorProfile = defineCreatorProfile(sequelize);
const Tier = defineTier(sequelize);
const Content = defineContent(sequelize);
const Subscription = defineSubscription(sequelize);
const Comment = defineComment(sequelize);

// 1. User <-> CreatorProfile (1:1)
User.hasOne(CreatorProfile, {
  foreignKey: 'userId',
  as: 'profile',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
CreatorProfile.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// 2. User (creator) <-> Content (1:N)
User.hasMany(Content, {
  foreignKey: 'creatorId',
  as: 'contents',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
Content.belongsTo(User, {
  foreignKey: 'creatorId',
  as: 'creator',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// 3. Tier <-> Content (1:N)
Tier.hasMany(Content, {
  foreignKey: 'minTierId',
  as: 'contents',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});
Content.belongsTo(Tier, {
  foreignKey: 'minTierId',
  as: 'minTier',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

// 4. Subscriptions (M:N User <-> User through Subscription)
User.belongsToMany(User, {
  through: Subscription,
  as: 'subscribedTo',
  foreignKey: 'subscriberId',
  otherKey: 'creatorId'
});
User.belongsToMany(User, {
  through: Subscription,
  as: 'subscribers',
  foreignKey: 'creatorId',
  otherKey: 'subscriberId'
});

// Subscription direct associations
Subscription.belongsTo(User, {
  foreignKey: 'subscriberId',
  as: 'subscriber',
  onDelete: 'CASCADE'
});
Subscription.belongsTo(User, {
  foreignKey: 'creatorId',
  as: 'creator',
  onDelete: 'CASCADE'
});
Subscription.belongsTo(Tier, {
  foreignKey: 'tierId',
  as: 'tier',
  onDelete: 'RESTRICT'
});
Tier.hasMany(Subscription, {
  foreignKey: 'tierId',
  as: 'subscriptions'
});

// 5. Content <-> Comment (1:N) and User <-> Comment (1:N)
Content.hasMany(Comment, {
  foreignKey: 'contentId',
  as: 'comments',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
Comment.belongsTo(Content, {
  foreignKey: 'contentId',
  as: 'content',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

User.hasMany(Comment, {
  foreignKey: 'userId',
  as: 'comments',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
Comment.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

module.exports = {
  sequelize,
  User,
  CreatorProfile,
  Tier,
  Content,
  Subscription,
  Comment
};
