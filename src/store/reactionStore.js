'use strict';

const crypto = require('crypto');
const { sequelize, ContentReaction } = require('../models');

const reactionStore = {
  /**
   * Idempotently adds a like reaction.
   *
   * @param {Object} params
   * @param {string} params.contentId
   * @param {string} params.userId
   * @returns {Promise<{ created: boolean }>}
   */
  async addLike({ contentId, userId }) {
    const id = crypto.randomUUID();
    const [result, metadata] = await sequelize.query(
      `INSERT IGNORE INTO content_reactions (id, content_id, user_id, created_at)
       VALUES (:id, :contentId, :userId, NOW())`,
      {
        replacements: { id, contentId, userId }
      }
    );

    const affected =
      result && result.affectedRows !== undefined
        ? result.affectedRows
        : metadata && metadata.affectedRows !== undefined
          ? metadata.affectedRows
          : typeof result === 'number'
            ? result
            : 0;

    return { created: affected > 0 };
  },

  /**
   * Idempotently removes a like reaction.
   *
   * @param {Object} params
   * @param {string} params.contentId
   * @param {string} params.userId
   * @returns {Promise<{ deleted: boolean }>}
   */
  async removeLike({ contentId, userId }) {
    const deletedCount = await ContentReaction.destroy({
      where: {
        contentId,
        userId
      }
    });

    return { deleted: deletedCount > 0 };
  },

  /**
   * Gets total like count for a specific content item.
   *
   * @param {string} contentId
   * @returns {Promise<number>}
   */
  async getLikeCount(contentId) {
    if (!contentId) return 0;
    return ContentReaction.count({ where: { contentId } });
  },

  /**
   * Checks whether a specific user has liked a content item.
   *
   * @param {string} contentId
   * @param {string} [userId]
   * @returns {Promise<boolean>}
   */
  async isLikedBy(contentId, userId) {
    if (!contentId || !userId) return false;
    const count = await ContentReaction.count({
      where: { contentId, userId }
    });
    return count > 0;
  },

  /**
   * Batch fetches like counts and likedByMe status for multiple contents in constant O(1) queries.
   *
   * @param {string[]} contentIds
   * @param {string} [userId]
   * @returns {Promise<Map<string, { likeCount: number, likedByMe: boolean }>>}
   */
  async batchGetLikes(contentIds = [], userId = null) {
    const map = new Map();
    if (!contentIds || contentIds.length === 0) {
      return map;
    }

    const uniqueIds = [...new Set(contentIds.filter(Boolean))];
    for (const id of uniqueIds) {
      map.set(id, { likeCount: 0, likedByMe: false });
    }

    if (uniqueIds.length === 0) {
      return map;
    }

    const rows = await sequelize.query(
      `SELECT
         content_id AS contentId,
         COUNT(*) AS likeCount,
         ${userId ? 'SUM(CASE WHEN user_id = :userId THEN 1 ELSE 0 END)' : '0'} AS userLiked
       FROM content_reactions
       WHERE content_id IN (:uniqueIds)
       GROUP BY content_id`,
      {
        replacements: { uniqueIds, userId },
        type: sequelize.QueryTypes.SELECT
      }
    );

    for (const row of rows) {
      const entry = map.get(row.contentId) || { likeCount: 0, likedByMe: false };
      entry.likeCount = parseInt(row.likeCount, 10) || 0;
      entry.likedByMe = (parseInt(row.userLiked, 10) || 0) > 0;
      map.set(row.contentId, entry);
    }

    return map;
  }
};

module.exports = reactionStore;
