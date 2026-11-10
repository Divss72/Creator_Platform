'use strict';

/**
 * Resolvers for ContentItem type.
 * Ensures zero body and media leakage for locked items and batches comment/media counts.
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
        bio: parent.creator.bio || null,
        avatarUrl: parent.creator.avatarUrl || null
      };
    }
    return context.loaders.creatorLoader.load(parent.creatorId);
  },
  commentCount(parent, _args, context) {
    return context.loaders.commentCountLoader.load(parent.id);
  },
  async media(parent, _args, context) {
    // Defense-in-depth: locked posts return empty media array (zero URL or publicId leakage)
    if (parent.locked) {
      return [];
    }

    const rawMedia = await context.loaders.mediaByContentIdLoader.load(parent.id);
    const mediaService = require('../../services/mediaService');
    return mediaService.signMediaList(rawMedia, true);
  },
  async mediaCount(parent, _args, context) {
    if (parent.mediaCount !== undefined) {
      return parent.mediaCount;
    }
    const rawMedia = await context.loaders.mediaByContentIdLoader.load(parent.id);
    return rawMedia.length;
  }
};

module.exports = {
  ContentItem: contentItemResolvers
};
