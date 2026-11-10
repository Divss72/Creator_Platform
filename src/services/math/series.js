'use strict';

/**
 * Time series range parsing, UTC day boundary calculations, and continuous series filling.
 */

const VALID_RANGES = new Set(['7d', '30d', '90d']);
const RANGE_DAYS = {
  '7d': 7,
  '30d': 30,
  '90d': 90
};

/**
 * Format a Date object to UTC YYYY-MM-DD.
 */
function toUtcDateString(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

/**
 * Parse and validate a range parameter ('7d', '30d', '90d').
 *
 * @param {string} rangeStr
 * @param {Date} [now=new Date()]
 * @returns {{ range: string, daysCount: number, from: string, to: string, prevFrom: string, prevTo: string }}
 */
function parseAnalyticsRange(rangeStr = '30d', now = new Date()) {
  const normalized = String(rangeStr).toLowerCase().trim();
  if (!VALID_RANGES.has(normalized)) {
    throw new Error(`Invalid analytics range '${rangeStr}'. Must be one of: 7d, 30d, 90d`);
  }

  const daysCount = RANGE_DAYS[normalized];
  const nowDate = now instanceof Date ? now : new Date(now);

  // UTC midnight for today
  const toUtcMs = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
  const fromUtcMs = toUtcMs - (daysCount - 1) * 86400000;

  // Previous period: equal length immediately preceding
  const prevToUtcMs = fromUtcMs - 86400000;
  const prevFromUtcMs = prevToUtcMs - (daysCount - 1) * 86400000;

  return {
    range: normalized,
    daysCount,
    from: toUtcDateString(new Date(fromUtcMs)),
    to: toUtcDateString(new Date(toUtcMs)),
    prevFrom: toUtcDateString(new Date(prevFromUtcMs)),
    prevTo: toUtcDateString(new Date(prevToUtcMs))
  };
}

/**
 * Fills missing calendar days in a time series array.
 * Flows (views, likes, comments, etc.) are 0-filled.
 * Stock metrics (activeSubscribers, byTier, mrrCents) are carried forward from the previous day.
 *
 * @param {Object} params
 * @param {string} params.from Start date (YYYY-MM-DD)
 * @param {string} params.to End date (YYYY-MM-DD)
 * @param {Array<Object>} params.existingDays Array of day objects from DB or live today
 * @param {Object} [params.initialStock] Stock values to seed if first day is missing
 * @returns {Array<Object>} Continuous array with exactly 1 entry per day
 */
function fillContinuousTimeSeries({ from, to, existingDays = [], initialStock = null }) {
  const byDayMap = new Map();
  for (const row of existingDays) {
    if (row && row.day) {
      byDayMap.set(row.day, row);
    }
  }

  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);

  let lastStock = initialStock
    ? { ...initialStock }
    : {
        activeSubscribers: 0,
        byTier: { free: 0, pro: 0, vip: 0 },
        mrrCents: 0
      };

  const result = [];
  const current = new Date(fromDate.getTime());

  while (current.getTime() <= toDate.getTime()) {
    const dayStr = toUtcDateString(current);
    const existing = byDayMap.get(dayStr);

    if (existing) {
      lastStock = {
        activeSubscribers:
          existing.activeSubscribers !== undefined
            ? existing.activeSubscribers
            : lastStock.activeSubscribers,
        byTier: existing.byTier
          ? { ...existing.byTier }
          : {
              free: existing.freeSubscribers || 0,
              pro: existing.proSubscribers || 0,
              vip: existing.vipSubscribers || 0
            },
        mrrCents: existing.mrrCents !== undefined ? existing.mrrCents : lastStock.mrrCents
      };

      result.push({
        day: dayStr,
        views: existing.views || 0,
        lockedViews: existing.lockedViews || 0,
        likes: existing.likes || 0,
        comments: existing.comments || 0,
        newSubscribers: existing.newSubscribers || 0,
        cancellations: existing.cancellations || 0,
        activeSubscribers: lastStock.activeSubscribers,
        byTier: { ...lastStock.byTier },
        mrrCents: lastStock.mrrCents
      });
    } else {
      // Missing day: flows are 0, stock carried forward
      result.push({
        day: dayStr,
        views: 0,
        lockedViews: 0,
        likes: 0,
        comments: 0,
        newSubscribers: 0,
        cancellations: 0,
        activeSubscribers: lastStock.activeSubscribers,
        byTier: { ...lastStock.byTier },
        mrrCents: lastStock.mrrCents
      });
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
}

module.exports = {
  VALID_RANGES,
  toUtcDateString,
  parseAnalyticsRange,
  fillContinuousTimeSeries
};
