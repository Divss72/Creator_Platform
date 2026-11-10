'use strict';

const contentStore = require('../store/contentStore');
const reactionStore = require('../store/reactionStore');
const accessService = require('./accessService');
const ApiError = require('../utils/apiError');

const likeService = {
  /**
   * Idempotently adds a like to a post.
   * Gated by full read access (accessService).
   * Creators cannot like their own posts.
   *
   * @param {Object} params
   * @param {string} params.contentId
   * @param {Object} params.user Authenticated user object
   * @returns {Promise<{ liked: boolean, likeCount: number }>}
   */
  async likePost({ contentId, user }) {
    if (!user || !user.id) {
      throw ApiError.unauthorized('Authentication required to like posts');
    }

    const content = await contentStore.findById(contentId);
    if (!content) {
      throw ApiError.notFound('Content not found');
    }

    // Creator self-like forbidden
    if (content.creatorId === user.id) {
      throw ApiError.forbidden('Creators cannot like their own posts');
    }

    // Access check: viewer must have full unlocked access to like
    const access = await accessService.resolveAccess({ viewer: user, content });
    if (!access.hasAccess) {
      throw ApiError.tierRequired('TIER_REQUIRED: You must unlock this post to like it');
    }

    await reactionStore.addLike({ contentId, userId: user.id });
    const likeCount = await reactionStore.getLikeCount(contentId);

    return { liked: true, likeCount };
  },

  /**
   * Idempotently removes a like from a post.
   *
   * @param {Object} params
   * @param {string} params.contentId
   * @param {Object} params.user Authenticated user object
   * @returns {Promise<{ liked: boolean, likeCount: number }>}
   */
  async unlikePost({ contentId, user }) {
    if (!user || !user.id) {
      throw ApiError.unauthorized('Authentication required to unlike posts');
    }

    const content = await contentStore.findById(contentId);
    if (!content) {
      throw ApiError.notFound('Content not found');
    }

    await reactionStore.removeLike({ contentId, userId: user.id });
    const likeCount = await reactionStore.getLikeCount(contentId);

    return { liked: false, likeCount };
  }
};

module.exports = likeService;
