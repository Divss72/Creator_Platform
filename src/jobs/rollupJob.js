'use strict';

const cron = require('node-cron');
const env = require('../config/env');
const rollupService = require('../services/rollupService');
const { toUtcDateString } = require('../services/math/series');

let task = null;

async function runOnce({ now = new Date() } = {}) {
  try {
    const nowDate = now instanceof Date ? now : new Date(now);
    const yesterday = new Date(nowDate.getTime() - 86400000);
    const twoDaysAgo = new Date(nowDate.getTime() - 2 * 86400000);

    const fromDate = toUtcDateString(twoDaysAgo);
    const toDate = toUtcDateString(yesterday);

    const result = await rollupService.processRollups({ fromDate, toDate });
    return result;
  } catch (err) {
    console.error('[RollupJob] Error during rollup run:', err.message);
    throw err;
  }
}

function startRollupJob() {
  if (task) return;

  try {
    task = cron.schedule(env.ROLLUP_CRON, async () => {
      console.log('[RollupJob] Running scheduled creator analytics rollup...');
      try {
        const stats = await runOnce();
        console.log(
          `[RollupJob] Completed rollup for ${stats.processedCreators} creators over ${stats.daysCount} days.`
        );
      } catch (err) {
        console.error('[RollupJob] Error in scheduled rollup:', err.message);
      }
    });

    console.log(`[RollupJob] Scheduled rollup job with cron "${env.ROLLUP_CRON}".`);
  } catch (err) {
    console.error('[RollupJob] Failed to schedule rollup cron:', err.message);
  }
}

function stopRollupJob() {
  if (task) {
    task.stop();
    task = null;
    console.log('[RollupJob] Stopped rollup cron job.');
  }
}

module.exports = {
  runOnce,
  startRollupJob,
  stopRollupJob
};
