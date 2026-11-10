'use strict';

const { sequelize, User } = require('../models');
const analyticsStore = require('../store/analyticsStore');
const tierStore = require('../store/tierStore');
const {
  computeDailyEventDeltas,
  applyStockDeltas,
  calculateEstimatedMrrCents
} = require('./math/rollupMath');
const { toUtcDateString } = require('./math/series');

const rollupService = {
  /**
   * Helper to load tier mapping: id -> name and name -> priceCents
   */
  async getTierMetadata() {
    const tiers = await tierStore.findAll();
    const tierIdToName = new Map();
    const tierPrices = { free: 0, pro: 1500, vip: 5000 };

    for (const t of tiers) {
      tierIdToName.set(t.id, t.name.toLowerCase());
      tierPrices[t.name.toLowerCase()] = t.priceCents;
    }

    return { tierIdToName, tierPrices };
  },

  /**
   * Computes and upserts daily rollup for a creator on a specific calendar day.
   *
   * @param {Object} params
   * @param {string} params.creatorId
   * @param {string} params.dayStr YYYY-MM-DD
   * @param {Object} [params.prevStock=null]
   * @param {Map<string, string>} [params.tierIdToName=null]
   * @param {Object} [params.tierPrices=null]
   * @returns {Promise<Object>} new stock for chaining
   */
  async rollupDayForCreator({
    creatorId,
    dayStr,
    prevStock = null,
    tierIdToName = null,
    tierPrices = null
  }) {
    let idToName = tierIdToName;
    let prices = tierPrices;
    if (!idToName || !prices) {
      const meta = await this.getTierMetadata();
      idToName = meta.tierIdToName;
      prices = meta.tierPrices;
    }

    // 1. Get initial stock if not provided
    let stock = prevStock;
    if (!stock) {
      const prev = await analyticsStore.getLatestDailyStatsBefore(creatorId, dayStr);
      stock = prev
        ? {
            free: prev.byTier.free,
            pro: prev.byTier.pro,
            vip: prev.byTier.vip,
            total: prev.activeSubscribers
          }
        : { free: 0, pro: 0, vip: 0, total: 0 };
    }

    const startDateTime = `${dayStr} 00:00:00`;
    const endDateTime = `${dayStr} 23:59:59`;

    // 2. Fetch subscription events on this day
    const eventQuery = `
      SELECT id, subscriber_id AS subscriberId, creator_id AS creatorId,
             from_tier_id AS fromTierId, to_tier_id AS toTierId, event, created_at AS createdAt
      FROM subscription_events
      WHERE creator_id = :creatorId
        AND created_at >= :startDateTime
        AND created_at <= :endDateTime
      ORDER BY created_at ASC
    `;

    // 3. Fetch content metrics on this day
    const viewQuery = `
      SELECT
        COALESCE(SUM(cds.views), 0) AS views,
        COALESCE(SUM(cds.locked_views), 0) AS lockedViews
      FROM content_daily_stats cds
      JOIN content c ON c.id = cds.content_id
      WHERE c.creator_id = :creatorId AND cds.day = :dayStr
    `;

    const likeQuery = `
      SELECT COUNT(*) AS likes
      FROM content_reactions cr
      JOIN content c ON c.id = cr.content_id
      WHERE c.creator_id = :creatorId
        AND cr.created_at >= :startDateTime
        AND cr.created_at <= :endDateTime
    `;

    const commentQuery = `
      SELECT COUNT(*) AS comments
      FROM comments cm
      JOIN content c ON c.id = cm.content_id
      WHERE c.creator_id = :creatorId
        AND cm.created_at >= :startDateTime
        AND cm.created_at <= :endDateTime
    `;

    const [events, viewRows, likeRows, commentRows] = await Promise.all([
      sequelize.query(eventQuery, {
        replacements: { creatorId, startDateTime, endDateTime },
        type: sequelize.QueryTypes.SELECT
      }),
      sequelize.query(viewQuery, {
        replacements: { creatorId, dayStr },
        type: sequelize.QueryTypes.SELECT
      }),
      sequelize.query(likeQuery, {
        replacements: { creatorId, startDateTime, endDateTime },
        type: sequelize.QueryTypes.SELECT
      }),
      sequelize.query(commentQuery, {
        replacements: { creatorId, startDateTime, endDateTime },
        type: sequelize.QueryTypes.SELECT
      })
    ]);

    // 4. Calculate deltas and new stock
    const { deltas, newSubscribers, cancellations } = computeDailyEventDeltas(events, idToName);
    const newStock = applyStockDeltas(stock, deltas);
    const mrrCents = calculateEstimatedMrrCents(newStock, prices);

    const views = Number((viewRows[0] && viewRows[0].views) || 0);
    const lockedViews = Number((viewRows[0] && viewRows[0].lockedViews) || 0);
    const likes = Number((likeRows[0] && likeRows[0].likes) || 0);
    const comments = Number((commentRows[0] && commentRows[0].comments) || 0);

    // 5. Persist rollup
    await analyticsStore.upsertCreatorDailyStats({
      creatorId,
      day: dayStr,
      stats: {
        activeSubscribers: newStock.total,
        freeSubscribers: newStock.free,
        proSubscribers: newStock.pro,
        vipSubscribers: newStock.vip,
        mrrCents,
        newSubscribers,
        cancellations,
        views,
        lockedViews,
        likes,
        comments
      }
    });

    return newStock;
  },

  /**
   * Recomputes rollups for a creator across a continuous date range.
   *
   * @param {Object} params
   * @param {string} params.creatorId
   * @param {string} params.fromDate YYYY-MM-DD
   * @param {string} params.toDate YYYY-MM-DD
   * @returns {Promise<void>}
   */
  async rollupRangeForCreator({ creatorId, fromDate, toDate }) {
    const meta = await this.getTierMetadata();
    const from = new Date(`${fromDate}T00:00:00.000Z`);
    const to = new Date(`${toDate}T00:00:00.000Z`);

    let current = new Date(from.getTime());
    let currentStock = null;

    while (current.getTime() <= to.getTime()) {
      const dayStr = toUtcDateString(current);
      currentStock = await this.rollupDayForCreator({
        creatorId,
        dayStr,
        prevStock: currentStock,
        tierIdToName: meta.tierIdToName,
        tierPrices: meta.tierPrices
      });
      current.setUTCDate(current.getUTCDate() + 1);
    }
  },

  /**
   * Runs daily rollup for all creators on a specific day.
   *
   * @param {Object} params
   * @param {string} params.dayStr YYYY-MM-DD
   * @returns {Promise<{ processedCreators: number }>}
   */
  async rollupAllCreatorsForDay({ dayStr }) {
    const meta = await this.getTierMetadata();
    const creators = await User.findAll({
      where: { role: 'creator' },
      attributes: ['id'],
      raw: true
    });

    for (const c of creators) {
      await this.rollupDayForCreator({
        creatorId: c.id,
        dayStr,
        prevStock: null,
        tierIdToName: meta.tierIdToName,
        tierPrices: meta.tierPrices
      });
    }

    return { processedCreators: creators.length };
  },

  /**
   * Processes rollups for missing or recomputed days up to yesterday.
   *
   * @param {Object} params
   * @param {string} params.fromDate YYYY-MM-DD
   * @param {string} params.toDate YYYY-MM-DD
   * @param {string} [params.creatorId=null]
   * @returns {Promise<{ processedCreators: number, daysCount: number }>}
   */
  async processRollups({ fromDate, toDate, creatorId = null }) {
    const meta = await this.getTierMetadata();
    let creatorIds;

    if (creatorId) {
      creatorIds = [creatorId];
    } else {
      const creators = await User.findAll({
        where: { role: 'creator' },
        attributes: ['id'],
        raw: true
      });
      creatorIds = creators.map((c) => c.id);
    }

    const from = new Date(`${fromDate}T00:00:00.000Z`);
    const to = new Date(`${toDate}T00:00:00.000Z`);
    const daysCount = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;

    for (const id of creatorIds) {
      let current = new Date(from.getTime());
      let currentStock = null;

      while (current.getTime() <= to.getTime()) {
        const dayStr = toUtcDateString(current);
        currentStock = await this.rollupDayForCreator({
          creatorId: id,
          dayStr,
          prevStock: currentStock,
          tierIdToName: meta.tierIdToName,
          tierPrices: meta.tierPrices
        });
        current.setUTCDate(current.getUTCDate() + 1);
      }
    }

    return {
      processedCreators: creatorIds.length,
      daysCount
    };
  }
};

module.exports = rollupService;
