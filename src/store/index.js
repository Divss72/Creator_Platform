const userStore = require('./userStore');
const contentStore = require('./contentStore');
const subscriptionStore = require('./subscriptionStore');
const tierStore = require('./tierStore');
const commentStore = require('./commentStore');
const outboxStore = require('./outboxStore');
const viewStore = require('./viewStore');
const reactionStore = require('./reactionStore');
const trendingStore = require('./trendingStore');
const analyticsStore = require('./analyticsStore');

module.exports = {
  userStore,
  contentStore,
  subscriptionStore,
  tierStore,
  commentStore,
  outboxStore,
  viewStore,
  reactionStore,
  trendingStore,
  analyticsStore
};
