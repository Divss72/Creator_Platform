'use strict';

const { sequelize, ContentTrending } = require('../models');

const trendingStore = {
  /**
   * Fetches content items published in the past windowDays with aggregated metrics
   * (views, likes, and distinct non-owner commenters) for trending score calculation.
   *
   * @param {Object} [params]
   * @param {number} [params.windowDays=30]
   * @returns {Promise<Array<{ id: string, creatorId: string, createdAt: Date, views: number, likes: number, commenters: number }>>}
   */
  async fetchRecentContentCandidates({ windowDays = 30 } = {}) {
    const safeDays = Math.max(1, parseInt(windowDays, 10) || 30);

    const query = `
      SELECT
        c.id,
        c.creator_id AS creatorId,
        c.created_at AS createdAt,
        COALESCE(v.total_views, 0) AS views,
        COALESCE(l.total_likes, 0) AS likes,
        COALESCE(cm.total_commenters, 0) AS commenters
      FROM content c
      LEFT JOIN (
        SELECT content_id, SUM(views + locked_views) AS total_views
        FROM content_daily_stats
        GROUP BY content_id
      ) v ON v.content_id = c.id
      LEFT JOIN (
        SELECT content_id, COUNT(*) AS total_likes
        FROM content_reactions
        GROUP BY content_id
      ) l ON l.content_id = c.id
      LEFT JOIN (
        SELECT cm_inner.content_id, COUNT(DISTINCT cm_inner.user_id) AS total_commenters
        FROM comments cm_inner
        JOIN content c_inner ON c_inner.id = cm_inner.content_id
        WHERE cm_inner.user_id != c_inner.creator_id
        GROUP BY cm_inner.content_id
      ) cm ON cm.content_id = c.id
      WHERE c.created_at >= DATE_SUB(NOW(), INTERVAL :windowDays DAY)
    `;

    const candidates = await sequelize.query(query, {
      replacements: { windowDays: safeDays },
      type: sequelize.QueryTypes.SELECT
    });

    return candidates.map((row) => ({
      id: row.id,
      creatorId: row.creatorId,
      createdAt: new Date(row.createdAt),
      views: Number(row.views) || 0,
      likes: Number(row.likes) || 0,
      commenters: Number(row.commenters) || 0
    }));
  },

  /**
   * Atomically replaces the current content_trending table in a single transaction.
   * Callers never observe an empty or partially populated table.
   *
   * @param {Array<{ contentId: string, score: number, rankPosition: number, computedAt: Date }>} rankedRows
   * @returns {Promise<void>}
   */
  async replaceTrending(rankedRows = []) {
    return sequelize.transaction(async (t) => {
      await ContentTrending.destroy({ where: {}, transaction: t });
      if (rankedRows.length > 0) {
        await ContentTrending.bulkCreate(rankedRows, { transaction: t });
      }
    });
  },

  /**
   * Retrieves trending items ordered by rank position.
   *
   * @param {Object} [params]
   * @param {number} [params.limit=10]
   * @returns {Promise<{ computedAt: Date|null, items: Array<{ rank: number, score: number, content: Object }> }>}
   */
  async getTrending({ limit = 10 } = {}) {
    const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 10), 50);

    const trendingRows = await ContentTrending.findAll({
      order: [['rankPosition', 'ASC']],
      limit: safeLimit,
      raw: true
    });

    if (trendingRows.length === 0) {
      return {
        computedAt: null,
        items: []
      };
    }

    const computedAt = trendingRows[0].computedAt;
    const contentIds = trendingRows.map((r) => r.contentId);

    const contentStore = require('./contentStore');
    const items = await contentStore.findByIds(contentIds);
    const itemMap = new Map(items.map((item) => [item.id, item]));

    const orderedItems = [];
    for (const row of trendingRows) {
      const content = itemMap.get(row.contentId);
      if (content) {
        orderedItems.push({
          rank: row.rankPosition,
          score: Number(row.score) || 0,
          content
        });
      }
    }

    return {
      computedAt,
      items: orderedItems
    };
  }
};

module.exports = trendingStore;
