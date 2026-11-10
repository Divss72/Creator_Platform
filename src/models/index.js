'use strict';

const { sequelize } = require('../config/database');

const defineUser = require('./User');
const defineCreatorProfile = require('./CreatorProfile');
const defineTier = require('./Tier');
const defineContent = require('./Content');
const defineSubscription = require('./Subscription');
const defineComment = require('./Comment');
const defineMedia = require('./Media');
const defineEmailOutbox = require('./EmailOutbox');
const defineContentReaction = require('./ContentReaction');
const defineContentViewDedupe = require('./ContentViewDedupe');
const defineContentDailyStats = require('./ContentDailyStats');
const defineSubscriptionEvent = require('./SubscriptionEvent');
const defineCreatorDailyStats = require('./CreatorDailyStats');
const defineContentTrending = require('./ContentTrending');

// Initialize models
const User = defineUser(sequelize);
const CreatorProfile = defineCreatorProfile(sequelize);
const Tier = defineTier(sequelize);
const Content = defineContent(sequelize);
const Subscription = defineSubscription(sequelize);
const Comment = defineComment(sequelize);
const Media = defineMedia(sequelize);
const EmailOutbox = defineEmailOutbox(sequelize);
const ContentReaction = defineContentReaction(sequelize);
const ContentViewDedupe = defineContentViewDedupe(sequelize);
const ContentDailyStats = defineContentDailyStats(sequelize);
const SubscriptionEvent = defineSubscriptionEvent(sequelize);
const CreatorDailyStats = defineCreatorDailyStats(sequelize);
const ContentTrending = defineContentTrending(sequelize);

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

// 6. Content <-> Media (1:N)
Content.hasMany(Media, {
  foreignKey: 'contentId',
  as: 'media',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
Media.belongsTo(Content, {
  foreignKey: 'contentId',
  as: 'content',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// 7. User (creator) <-> Media (1:N)
User.hasMany(Media, {
  foreignKey: 'creatorId',
  as: 'media',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
Media.belongsTo(User, {
  foreignKey: 'creatorId',
  as: 'creator',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// 8. User <-> EmailOutbox (1:N)
User.hasMany(EmailOutbox, {
  foreignKey: 'userId',
  as: 'outboxEmails',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
EmailOutbox.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// 9. Content <-> ContentReaction (1:N) and User <-> ContentReaction (1:N)
Content.hasMany(ContentReaction, {
  foreignKey: 'contentId',
  as: 'reactions',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
ContentReaction.belongsTo(Content, {
  foreignKey: 'contentId',
  as: 'content',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
User.hasMany(ContentReaction, {
  foreignKey: 'userId',
  as: 'reactions',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
ContentReaction.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// 10. Content <-> ContentDailyStats (1:N)
Content.hasMany(ContentDailyStats, {
  foreignKey: 'contentId',
  as: 'dailyStats',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
ContentDailyStats.belongsTo(Content, {
  foreignKey: 'contentId',
  as: 'content',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// 11. User (creator) <-> CreatorDailyStats (1:N)
User.hasMany(CreatorDailyStats, {
  foreignKey: 'creatorId',
  as: 'dailyStats',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
CreatorDailyStats.belongsTo(User, {
  foreignKey: 'creatorId',
  as: 'creator',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// 12. User <-> SubscriptionEvent (1:N)
User.hasMany(SubscriptionEvent, {
  foreignKey: 'subscriberId',
  as: 'subscriberEvents',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
User.hasMany(SubscriptionEvent, {
  foreignKey: 'creatorId',
  as: 'creatorEvents',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
SubscriptionEvent.belongsTo(User, {
  foreignKey: 'subscriberId',
  as: 'subscriber',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
SubscriptionEvent.belongsTo(User, {
  foreignKey: 'creatorId',
  as: 'creator',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// 13. Content <-> ContentTrending (1:1)
Content.hasOne(ContentTrending, {
  foreignKey: 'contentId',
  as: 'trending',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});
ContentTrending.belongsTo(Content, {
  foreignKey: 'contentId',
  as: 'content',
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
  Comment,
  Media,
  EmailOutbox,
  ContentReaction,
  ContentViewDedupe,
  ContentDailyStats,
  SubscriptionEvent,
  CreatorDailyStats,
  ContentTrending
};
