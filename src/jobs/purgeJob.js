'use strict';

const { outboxStore } = require('../store');

let purgeTimer = null;

async function runPurge() {
  try {
    const { deletedSent, deletedFailed } = await outboxStore.purgeOld({
      sentRetentionDays: 30,
      failedRetentionDays: 60
    });
    if (deletedSent > 0 || deletedFailed > 0) {
      console.log(
        `[PurgeJob] Purged ${deletedSent} sent and ${deletedFailed} failed/skipped outbox records.`
      );
    }
  } catch (err) {
    console.error('[PurgeJob] Error during outbox purge:', err.message);
  }
}

function startPurgeJob() {
  if (purgeTimer) return;
  // Run once on startup (after 30 seconds), then every 24 hours
  purgeTimer = setInterval(runPurge, 24 * 60 * 60 * 1000);
}

function stopPurgeJob() {
  if (purgeTimer) {
    clearInterval(purgeTimer);
    purgeTimer = null;
  }
}

module.exports = {
  startPurgeJob,
  stopPurgeJob,
  runPurge
};
