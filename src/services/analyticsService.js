'use strict';

const analyticsStore = require('../store/analyticsStore');
const { calculateChangePct, calculateChurnRate } = require('./math/rollupMath');
const { toUtcDateString, parseAnalyticsRange, fillContinuousTimeSeries } = require('./math/series');

const analyticsService = {
  /**
   * Fetches high-level creator KPI overview for the selected range.
   *
   * @param {Object} params
   * @param {string} params.creatorId
   * @param {string} [params.range='30d']
   * @param {Date} [params.now=new Date()]
   * @returns {Promise<Object>}
   */
  async getOverview({ creatorId, range = '30d', now = new Date() }) {
    const rangeInfo = parseAnalyticsRange(range, now);
    const todayStr = rangeInfo.to;

    // Yesterday string
    const todayDate = new Date(`${todayStr}T00:00:00.000Z`);
    const yesterdayDate = new Date(todayDate.getTime() - 86400000);
    const yesterdayStr = toUtcDateString(yesterdayDate);

    // 1. Current period data: historical rollups up to yesterday + today's live stats
    const [historical, todayLive, initialStock] = await Promise.all([
      rangeInfo.from <= yesterdayStr
        ? analyticsStore.getCreatorDailyStatsRange(creatorId, rangeInfo.from, yesterdayStr)
        : Promise.resolve([]),
      analyticsStore.getLiveTodayStats(creatorId, todayStr),
      analyticsStore.getLatestDailyStatsBefore(creatorId, rangeInfo.from)
    ]);

    const continuousCurrent = fillContinuousTimeSeries({
      from: rangeInfo.from,
      to: rangeInfo.to,
      existingDays: [...historical, todayLive],
      initialStock
    });

    // 2. Previous period data for change % calculations
    const [prevHistorical, prevInitialStock] = await Promise.all([
      analyticsStore.getCreatorDailyStatsRange(creatorId, rangeInfo.prevFrom, rangeInfo.prevTo),
      analyticsStore.getLatestDailyStatsBefore(creatorId, rangeInfo.prevFrom)
    ]);

    const continuousPrev = fillContinuousTimeSeries({
      from: rangeInfo.prevFrom,
      to: rangeInfo.prevTo,
      existingDays: prevHistorical,
      initialStock: prevInitialStock
    });

    // 3. Current period aggregates
    let totalViews = 0;
    let totalLockedViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalNewSubs = 0;
    let totalCancellations = 0;

    for (const d of continuousCurrent) {
      totalViews += d.views;
      totalLockedViews += d.lockedViews;
      totalLikes += d.likes;
      totalComments += d.comments;
      totalNewSubs += d.newSubscribers;
      totalCancellations += d.cancellations;
    }

    // 4. Previous period aggregates
    let prevViews = 0;
    let prevLikes = 0;
    let prevComments = 0;

    for (const d of continuousPrev) {
      prevViews += d.views;
      prevLikes += d.likes;
      prevComments += d.comments;
    }

    const prevEndStock =
      continuousPrev.length > 0
        ? continuousPrev[continuousPrev.length - 1]
        : { mrrCents: 0, activeSubscribers: 0 };

    const startStock =
      continuousCurrent.length > 0
        ? continuousCurrent[0].activeSubscribers
        : todayLive.activeSubscribers;

    return {
      range: rangeInfo.range,
      daysCount: rangeInfo.daysCount,
      period: {
        from: rangeInfo.from,
        to: rangeInfo.to
      },
      mrr: {
        currentCents: todayLive.mrrCents,
        changePct: calculateChangePct(todayLive.mrrCents, prevEndStock.mrrCents)
      },
      subscribers: {
        total: todayLive.activeSubscribers,
        byTier: {
          free: todayLive.freeSubscribers,
          pro: todayLive.proSubscribers,
          vip: todayLive.vipSubscribers
        },
        newInPeriod: totalNewSubs,
        cancellationsInPeriod: totalCancellations,
        changePct: calculateChangePct(todayLive.activeSubscribers, prevEndStock.activeSubscribers),
        churnRate: calculateChurnRate(totalCancellations, startStock)
      },
      engagement: {
        totalViews,
        lockedViews: totalLockedViews,
        viewsChangePct: calculateChangePct(totalViews, prevViews),
        totalLikes,
        likesChangePct: calculateChangePct(totalLikes, prevLikes),
        totalComments,
        commentsChangePct: calculateChangePct(totalComments, prevComments)
      }
    };
  },

  /**
   * Fetches day-by-day continuous time series for charting.
   *
   * @param {Object} params
   * @param {string} params.creatorId
   * @param {string} [params.range='30d']
   * @param {Date} [params.now=new Date()]
   * @returns {Promise<Array<Object>>}
   */
  async getTimeseries({ creatorId, range = '30d', now = new Date() }) {
    const rangeInfo = parseAnalyticsRange(range, now);
    const todayStr = rangeInfo.to;

    const todayDate = new Date(`${todayStr}T00:00:00.000Z`);
    const yesterdayDate = new Date(todayDate.getTime() - 86400000);
    const yesterdayStr = toUtcDateString(yesterdayDate);

    const [historical, todayLive, initialStock] = await Promise.all([
      rangeInfo.from <= yesterdayStr
        ? analyticsStore.getCreatorDailyStatsRange(creatorId, rangeInfo.from, yesterdayStr)
        : Promise.resolve([]),
      analyticsStore.getLiveTodayStats(creatorId, todayStr),
      analyticsStore.getLatestDailyStatsBefore(creatorId, rangeInfo.from)
    ]);

    return fillContinuousTimeSeries({
      from: rangeInfo.from,
      to: rangeInfo.to,
      existingDays: [...historical, todayLive],
      initialStock
    });
  },

  /**
   * Fetches top performing content items for a creator.
   *
   * @param {Object} params
   * @param {string} params.creatorId
   * @param {string} [params.range='30d']
   * @param {string} [params.sortBy='views'] views | likes | comments | trending
   * @param {number} [params.limit=10]
   * @param {Date} [params.now=new Date()]
   * @returns {Promise<Array<Object>>}
   */
  async getTopContent({
    creatorId,
    range = '30d',
    sortBy = 'views',
    limit = 10,
    now = new Date()
  }) {
    const rangeInfo = parseAnalyticsRange(range, now);
    return analyticsStore.getTopContent({
      creatorId,
      startDate: rangeInfo.from,
      endDate: rangeInfo.to,
      sortBy,
      limit
    });
  }
};

module.exports = analyticsService;
