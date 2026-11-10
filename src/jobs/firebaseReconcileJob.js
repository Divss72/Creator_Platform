'use strict';

const cron = require('node-cron');
const { userStore } = require('../store');
const firebaseSyncService = require('../services/firebaseSyncService');

let task = null;

async function reconcileAllCreators() {
  try {
    const creatorIds = await userStore.listAllCreatorIds();
    console.log(`[FirebaseReconcile] Starting reconciliation for ${creatorIds.length} creators...`);
    for (const id of creatorIds) {
      await firebaseSyncService.syncCreatorMetrics(id, { immediate: true });
    }
    console.log('[FirebaseReconcile] Reconciliation complete.');
  } catch (err) {
    console.error('[FirebaseReconcile] Error reconciling creators:', err.message);
  }
}

function startReconcileJob() {
  if (task) return;

  // Run on startup
  reconcileAllCreators().catch(() => {});

  // Run once every hour: at minute 0
  task = cron.schedule('0 * * * *', async () => {
    await reconcileAllCreators();
  });

  console.log('[FirebaseReconcile] Scheduled hourly Firebase reconciliation job.');
}

function stopReconcileJob() {
  if (task) {
    task.stop();
    task = null;
    console.log('[FirebaseReconcile] Stopped Firebase reconciliation job.');
  }
}

module.exports = {
  startReconcileJob,
  stopReconcileJob,
  reconcileAllCreators
};

