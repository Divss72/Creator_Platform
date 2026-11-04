/**
 * Resolvers for ContentItem type.
 * Ensures zero body leakage for locked items and batches comment counts.
 */
const contentItemResolvers = {
  minTier(parent) {
    return parent.minTier || 'free';
  },
  viewerTier(parent) {
    return parent.viewerTier || 'free';
  },
  body(parent) {
    // Defense-in-depth: regardless of client query aliases or fragments, locked posts return null
    if (parent.locked) {
      return null;
    }
    return parent.body || null;
  },
  creator(parent, _args, context) {
    if (parent.creator && parent.creator.id) {
      return {
        id: parent.creator.id,
        displayName: parent.creator.displayName || parent.creator.name,
        bio: parent.creator.bio || null
      };
    }
    return context.loaders.creatorLoader.load(parent.creatorId);
  },
  commentCount(parent, _args, context) {
    return context.loaders.commentCountLoader.load(parent.id);
  }
};

module.exports = {
  ContentItem: contentItemResolvers
};
