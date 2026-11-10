'use strict';

const cron = require('node-cron');
const env = require('../config/env');
const digestService = require('../services/digestService');

let task = null;

function startDigestJob() {
  if (task) return;

  try {
    task = cron.schedule(
      env.DIGEST_CRON,
      async () => {
        console.log('[DigestJob] Running scheduled weekly digest generation...');
        try {
          const stats = await digestService.runDigest({ now: new Date() });
          console.log(`[DigestJob] Weekly digest complete: ${stats.enqueuedCount} enqueued, ${stats.skippedCount} skipped, ${stats.processedUsers} users processed.`);
        } catch (err) {
          console.error('[DigestJob] Error during scheduled digest run:', err.message);
        }
      },
      {
        timezone: env.DIGEST_TIMEZONE
      }
    );

    console.log(`[DigestJob] Scheduled digest job with cron "${env.DIGEST_CRON}" (${env.DIGEST_TIMEZONE}).`);
  } catch (err) {
    console.error('[DigestJob] Failed to schedule digest cron:', err.message);
  }
}

function stopDigestJob() {
  if (task) {
    task.stop();
    task = null;
    console.log('[DigestJob] Stopped digest cron job.');
  }
}

module.exports = {
  startDigestJob,
  stopDigestJob
};

