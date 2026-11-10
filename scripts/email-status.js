#!/usr/bin/env node
'use strict';

const env = require('../src/config/env');
const { outboxStore } = require('../src/store');
const { EmailOutbox } = require('../src/models');

async function main() {
  console.log('\n==================================================');
  console.log('CreatorHub Email Outbox & Driver Status');
  console.log(`Mail Driver:        ${env.MAIL_DRIVER}`);
  console.log(`From Address:       ${env.EMAIL_FROM}`);
  console.log(`Worker Poll Rate:   ${env.EMAIL_WORKER_POLL_MS}ms`);
  console.log(`Batch Size:         ${env.EMAIL_WORKER_BATCH_SIZE}`);
  console.log(`Rate Limit (Send):  ${env.EMAIL_RATE_LIMIT_PER_SEC}/sec`);
  console.log('==================================================\n');

  try {
    const statusCounts = await outboxStore.countByStatus();
    console.log('--- Outbox Status Breakdown ---');
    console.table([
      { Status: 'pending', Count: statusCounts.pending },
      { Status: 'sending', Count: statusCounts.sending },
      { Status: 'sent', Count: statusCounts.sent },
      { Status: 'failed', Count: statusCounts.failed },
      { Status: 'skipped', Count: statusCounts.skipped }
    ]);

    const recentFailed = await EmailOutbox.findAll({
      where: { status: 'failed' },
      order: [['updatedAt', 'DESC']],
      limit: 5,
      attributes: ['id', 'type', 'toEmail', 'attempts', 'lastError', 'updatedAt']
    });

    if (recentFailed.length > 0) {
      console.log('\n--- Recent Failed Outbox Items (Last 5) ---');
      console.table(
        recentFailed.map((r) => ({
          ID: r.id,
          Type: r.type,
          Recipient: r.toEmail,
          Attempts: r.attempts,
          Error: r.lastError,
          Updated: r.updatedAt
        }))
      );
    } else {
      console.log('\n✓ No failed outbox items found.');
    }

    console.log('\n==================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('💥 Failed to retrieve email status:', err);
    process.exit(1);
  }
}

main();

