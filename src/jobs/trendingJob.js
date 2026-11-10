'use strict';

const cron = require('node-cron');
const env = require('../config/env');
const trendingService = require('../services/trendingService');

let task = null;

async function runOnce({ now = new Date() } = {}) {
  try {
    const result = await trendingService.computeTrending({ now });
    return result;
  } catch (err) {
    console.error('[TrendingJob] Recompute error:', err.message);
    throw err;
  }
}

function startTrendingJob() {
  if (task) return;

  try {
    task = cron.schedule(env.TRENDING_CRON, async () => {
      console.log('[TrendingJob] Running scheduled trending leaderboard recomputation...');
      try {
        const stats = await runOnce();
        console.log(
          `[TrendingJob] Recomputed trending successfully: ${stats.computedCount} items ranked.`
        );
      } catch (err) {
        console.error('[TrendingJob] Error during scheduled trending run:', err.message);
      }
    });

    console.log(`[TrendingJob] Scheduled trending job with cron "${env.TRENDING_CRON}".`);
  } catch (err) {
    console.error('[TrendingJob] Failed to schedule trending cron:', err.message);
  }
}

function stopTrendingJob() {
  if (task) {
    task.stop();
    task = null;
    console.log('[TrendingJob] Stopped trending cron job.');
  }
}

module.exports = {
  runOnce,
  startTrendingJob,
  stopTrendingJob
};
