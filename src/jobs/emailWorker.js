'use strict';

const env = require('../config/env');
const { outboxStore } = require('../store');
const { processOutboxRow } = require('../services/outboxService');

class EmailWorker {
  constructor() {
    this.isRunning = false;
    this.pollTimer = null;
    this.reclaimTimer = null;
    this.currentBatchPromise = null;
  }

  /**
   * Start the background email worker
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[EmailWorker] Started outbox processing worker.');

    // Immediate initial poll
    this.scheduleNextPoll(100);

    // Periodic stuck row recovery every 60 seconds
    this.reclaimTimer = setInterval(async () => {
      try {
        const reclaimed = await outboxStore.reclaimStuckRows(5 * 60 * 1000);
        if (reclaimed > 0) {
          console.log(`[EmailWorker] Reclaimed ${reclaimed} stuck outbox rows.`);
        }
      } catch (err) {
        console.error('[EmailWorker] Error reclaiming stuck rows:', err.message);
      }
    }, 60 * 1000);
  }

  /**
   * Schedule next poll iteration
   */
  scheduleNextPoll(delayMs = env.EMAIL_WORKER_POLL_MS) {
    if (!this.isRunning) return;
    this.pollTimer = setTimeout(async () => {
      await this.poll();
    }, delayMs);
  }

  /**
   * Execute a single poll cycle
   */
  async poll() {
    if (!this.isRunning) return;

    try {
      this.currentBatchPromise = this.processBatch();
      await this.currentBatchPromise;
    } catch (err) {
      console.error('[EmailWorker] Error during batch processing:', err.message);
    } finally {
      this.currentBatchPromise = null;
      if (this.isRunning) {
        this.scheduleNextPoll();
      }
    }
  }

  /**
   * Fetch and process one batch of due outbox items
   */
  async processBatch() {
    const rows = await outboxStore.claimDueRows({ batchSize: env.EMAIL_WORKER_BATCH_SIZE });
    if (!rows || rows.length === 0) {
      return 0;
    }

    const intervalMs = Math.max(10, Math.floor(1000 / env.EMAIL_RATE_LIMIT_PER_SEC));

    for (const row of rows) {
      if (!this.isRunning) {
        // Worker was stopped, leave remaining rows in 'sending' to be reclaimed or gracefully abort
        break;
      }

      await processOutboxRow(row);

      // Rate limit delay between individual sends
      if (intervalMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    return rows.length;
  }

  /**
   * Graceful shutdown: stops scheduling and waits for in-flight batch
   */
  async stop() {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.reclaimTimer) {
      clearInterval(this.reclaimTimer);
      this.reclaimTimer = null;
    }

    if (this.currentBatchPromise) {
      try {
        await this.currentBatchPromise;
      } catch (_) {}
    }

    console.log('[EmailWorker] Stopped outbox processing worker.');
  }
}

module.exports = new EmailWorker();
