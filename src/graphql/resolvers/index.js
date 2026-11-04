const { DateTime } = require('../scalars');
const { Query } = require('./query');
const { ContentItem } = require('./contentItem');
const { Creator } = require('./creator');
const { Comment, CommentAuthor } = require('./comment');

const resolvers = {
  DateTime,
  TierName: {
    FREE: 'free',
    PRO: 'pro',
    VIP: 'vip'
  },
  Role: {
    CREATOR: 'creator',
    SUBSCRIBER: 'subscriber'
  },
  Query,
  ContentItem,
  Creator,
  Comment,
  CommentAuthor
};

module.exports = resolvers;
