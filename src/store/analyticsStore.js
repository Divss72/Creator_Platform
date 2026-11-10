'use strict';

const { Op } = require('sequelize');
const { sequelize, CreatorDailyStats } = require('../models');

const analyticsStore = {
  /**
   * Upsert a daily rollup record for a creator.
   *
   * @param {Object} params
   * @param {string} params.creatorId
   * @param {string} params.day YYYY-MM-DD
   * @param {Object} params.stats
   * @returns {Promise<void>}
   */
  async upsertCreatorDailyStats({ creatorId, day, stats }) {
    const query = `
      INSERT INTO creator_daily_stats (
        creator_id, day, active_subscribers, free_subscribers, pro_subscribers, vip_subscribers,
        mrr_cents, new_subscribers, cancellations, views, locked_views, likes, comments
      ) VALUES (
        :creatorId, :day, :activeSubscribers, :freeSubscribers, :proSubscribers, :vipSubscribers,
        :mrrCents, :newSubscribers, :cancellations, :views, :lockedViews, :likes, :comments
      ) ON DUPLICATE KEY UPDATE
        active_subscribers = VALUES(active_subscribers),
        free_subscribers = VALUES(free_subscribers),
        pro_subscribers = VALUES(pro_subscribers),
        vip_subscribers = VALUES(vip_subscribers),
        mrr_cents = VALUES(mrr_cents),
        new_subscribers = VALUES(new_subscribers),
        cancellations = VALUES(cancellations),
        views = VALUES(views),
        locked_views = VALUES(locked_views),
        likes = VALUES(likes),
        comments = VALUES(comments)
    `;

    await sequelize.query(query, {
      replacements: {
        creatorId,
        day,
        activeSubscribers: stats.activeSubscribers || 0,
        freeSubscribers: stats.freeSubscribers || 0,
        proSubscribers: stats.proSubscribers || 0,
        vipSubscribers: stats.vipSubscribers || 0,
        mrrCents: stats.mrrCents || 0,
        newSubscribers: stats.newSubscribers || 0,
        cancellations: stats.cancellations || 0,
        views: stats.views || 0,
        lockedViews: stats.lockedViews || 0,
        likes: stats.likes || 0,
        comments: stats.comments || 0
      }
    });
  },

  /**
   * Fetches historical creator daily stats in a date range.
   *
   * @param {string} creatorId
   * @param {string} startDate YYYY-MM-DD
   * @param {string} endDate YYYY-MM-DD
   * @returns {Promise<Array<Object>>}
   */
  async getCreatorDailyStatsRange(creatorId, startDate, endDate) {
    const rows = await CreatorDailyStats.findAll({
      where: {
        creatorId,
        day: {
          [Op.gte]: startDate,
          [Op.lte]: endDate
        }
      },
      order: [['day', 'ASC']],
      raw: true
    });

    return rows.map((r) => ({
      day: r.day,
      activeSubscribers: Number(r.activeSubscribers) || 0,
      freeSubscribers: Number(r.freeSubscribers) || 0,
      proSubscribers: Number(r.proSubscribers) || 0,
      vipSubscribers: Number(r.vipSubscribers) || 0,
      mrrCents: Number(r.mrrCents) || 0,
      newSubscribers: Number(r.newSubscribers) || 0,
      cancellations: Number(r.cancellations) || 0,
      views: Number(r.views) || 0,
      lockedViews: Number(r.lockedViews) || 0,
      likes: Number(r.likes) || 0,
      comments: Number(r.comments) || 0
    }));
  },

  /**
   * Finds the latest daily stats row before a given date (for initial stock carry forward).
   *
   * @param {string} creatorId
   * @param {string} beforeDate YYYY-MM-DD
   * @returns {Promise<Object|null>}
   */
  async getLatestDailyStatsBefore(creatorId, beforeDate) {
    const row = await CreatorDailyStats.findOne({
      where: {
        creatorId,
        day: {
          [Op.lt]: beforeDate
        }
      },
      order: [['day', 'DESC']],
      raw: true
    });

    if (!row) return null;

    return {
      activeSubscribers: Number(row.activeSubscribers) || 0,
      byTier: {
        free: Number(row.freeSubscribers) || 0,
        pro: Number(row.proSubscribers) || 0,
        vip: Number(row.vipSubscribers) || 0
      },
      mrrCents: Number(row.mrrCents) || 0
    };
  },

  /**
   * Fetches live today metrics from source tables for a creator.
   *
   * @param {string} creatorId
   * @param {string} todayStr YYYY-MM-DD
   * @returns {Promise<Object>}
   */
  async getLiveTodayStats(creatorId, todayStr) {
    const startOfToday = `${todayStr} 00:00:00`;

    // 1. Current active subscribers by tier & MRR
    const subQuery = `
      SELECT
        COUNT(*) AS activeSubscribers,
        SUM(CASE WHEN t.name = 'free' THEN 1 ELSE 0 END) AS freeSubscribers,
        SUM(CASE WHEN t.name = 'pro' THEN 1 ELSE 0 END) AS proSubscribers,
        SUM(CASE WHEN t.name = 'vip' THEN 1 ELSE 0 END) AS vipSubscribers,
        SUM(CASE WHEN t.name = 'free' THEN 0 WHEN t.name = 'pro' THEN t.price_cents WHEN t.name = 'vip' THEN t.price_cents ELSE 0 END) AS mrrCents
      FROM subscriptions s
      JOIN tiers t ON t.id = s.tier_id
      WHERE s.creator_id = :creatorId AND s.status = 'active'
    `;

    // 2. Today's subscription events
    const eventQuery = `
      SELECT
        SUM(CASE WHEN event IN ('created', 'reactivated') THEN 1 ELSE 0 END) AS newSubscribers,
        SUM(CASE WHEN event = 'cancelled' THEN 1 ELSE 0 END) AS cancellations
      FROM subscription_events
      WHERE creator_id = :creatorId AND created_at >= :startOfToday
    `;

    // 3. Today's views from content_daily_stats
    const viewQuery = `
      SELECT
        COALESCE(SUM(cds.views), 0) AS views,
        COALESCE(SUM(cds.locked_views), 0) AS lockedViews
      FROM content_daily_stats cds
      JOIN content c ON c.id = cds.content_id
      WHERE c.creator_id = :creatorId AND cds.day = :todayStr
    `;

    // 4. Today's reactions
    const likeQuery = `
      SELECT COUNT(*) AS likes
      FROM content_reactions cr
      JOIN content c ON c.id = cr.content_id
      WHERE c.creator_id = :creatorId AND cr.created_at >= :startOfToday
    `;

    // 5. Today's comments
    const commentQuery = `
      SELECT COUNT(*) AS comments
      FROM comments cm
      JOIN content c ON c.id = cm.content_id
      WHERE c.creator_id = :creatorId AND cm.created_at >= :startOfToday
    `;

    const [subRows, eventRows, viewRows, likeRows, commentRows] = await Promise.all([
      sequelize.query(subQuery, { replacements: { creatorId }, type: sequelize.QueryTypes.SELECT }),
      sequelize.query(eventQuery, {
        replacements: { creatorId, startOfToday },
        type: sequelize.QueryTypes.SELECT
      }),
      sequelize.query(viewQuery, {
        replacements: { creatorId, todayStr },
        type: sequelize.QueryTypes.SELECT
      }),
      sequelize.query(likeQuery, {
        replacements: { creatorId, startOfToday },
        type: sequelize.QueryTypes.SELECT
      }),
      sequelize.query(commentQuery, {
        replacements: { creatorId, startOfToday },
        type: sequelize.QueryTypes.SELECT
      })
    ]);

    const s = (subRows && subRows[0]) || {};
    const e = (eventRows && eventRows[0]) || {};
    const v = (viewRows && viewRows[0]) || {};
    const l = (likeRows && likeRows[0]) || {};
    const c = (commentRows && commentRows[0]) || {};

    return {
      day: todayStr,
      activeSubscribers: Number(s.activeSubscribers) || 0,
      freeSubscribers: Number(s.freeSubscribers) || 0,
      proSubscribers: Number(s.proSubscribers) || 0,
      vipSubscribers: Number(s.vipSubscribers) || 0,
      mrrCents: Number(s.mrrCents) || 0,
      newSubscribers: Number(e.newSubscribers) || 0,
      cancellations: Number(e.cancellations) || 0,
      views: Number(v.views) || 0,
      lockedViews: Number(v.lockedViews) || 0,
      likes: Number(l.likes) || 0,
      comments: Number(c.comments) || 0
    };
  },

  /**
   * Fetches top performing content for a creator within a date range.
   *
   * @param {Object} params
   * @param {string} params.creatorId
   * @param {string} params.startDate YYYY-MM-DD
   * @param {string} params.endDate YYYY-MM-DD
   * @param {string} [params.sortBy='views'] views | likes | comments | trending
   * @param {number} [params.limit=10]
   * @returns {Promise<Array<Object>>}
   */
  async getTopContent({ creatorId, startDate, endDate, sortBy = 'views', limit = 10 }) {
    const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 10), 50);

    let orderByClause = 'views DESC';
    if (sortBy === 'likes') {
      orderByClause = 'likes DESC';
    } else if (sortBy === 'comments') {
      orderByClause = 'comments DESC';
    } else if (sortBy === 'trending') {
      orderByClause = 'trending_score DESC';
    }

    const query = `
      SELECT
        c.id,
        c.title,
        c.min_tier_id,
        t.name AS minTier,
        c.created_at AS createdAt,
        COALESCE(v.total_views, 0) AS views,
        COALESCE(v.total_locked_views, 0) AS lockedViews,
        COALESCE(l.total_likes, 0) AS likes,
        COALESCE(cm.total_comments, 0) AS comments,
        COALESCE(tr.score, 0) AS trendingScore
      FROM content c
      LEFT JOIN tiers t ON t.id = c.min_tier_id
      LEFT JOIN (
        SELECT content_id,
               SUM(views) AS total_views,
               SUM(locked_views) AS total_locked_views
        FROM content_daily_stats
        WHERE day >= :startDate AND day <= :endDate
        GROUP BY content_id
      ) v ON v.content_id = c.id
      LEFT JOIN (
        SELECT content_id, COUNT(*) AS total_likes
        FROM content_reactions
        WHERE created_at >= :startDateTime AND created_at <= :endDateTime
        GROUP BY content_id
      ) l ON l.content_id = c.id
      LEFT JOIN (
        SELECT content_id, COUNT(*) AS total_comments
        FROM comments
        WHERE created_at >= :startDateTime AND created_at <= :endDateTime
        GROUP BY content_id
      ) cm ON cm.content_id = c.id
      LEFT JOIN content_trending tr ON tr.content_id = c.id
      WHERE c.creator_id = :creatorId
      ORDER BY ${orderByClause}, c.created_at DESC
      LIMIT :limit
    `;

    const startDateTime = `${startDate} 00:00:00`;
    const endDateTime = `${endDate} 23:59:59`;

    const rows = await sequelize.query(query, {
      replacements: {
        creatorId,
        startDate,
        endDate,
        startDateTime,
        endDateTime,
        limit: safeLimit
      },
      type: sequelize.QueryTypes.SELECT
    });

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      minTier: r.minTier || 'free',
      createdAt: r.createdAt,
      views: Number(r.views) || 0,
      lockedViews: Number(r.lockedViews) || 0,
      likes: Number(r.likes) || 0,
      comments: Number(r.comments) || 0,
      trendingScore: Number(r.trendingScore) || 0
    }));
  }
};

module.exports = analyticsStore;
