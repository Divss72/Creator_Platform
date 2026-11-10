#!/usr/bin/env node
'use strict';

const digestService = require('../src/services/digestService');

async function main() {
  const args = process.argv.slice(2);
  let now = new Date();
  let userId = null;
  let dryRun = false;

  for (const arg of args) {
    if (arg.startsWith('--now=')) {
      const parsed = new Date(arg.split('=')[1]);
      if (!Number.isNaN(parsed.getTime())) {
        now = parsed;
      } else {
        console.error(`Invalid date for --now: ${arg.split('=')[1]}`);
        process.exit(1);
      }
    } else if (arg.startsWith('--user=')) {
      userId = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  console.log('\n==================================================');
  console.log('CreatorHub Weekly Digest Generator (CLI)');
  console.log(`Reference Date: ${now.toISOString()}`);
  console.log(`Target User:    ${userId || 'ALL eligible subscribers'}`);
  console.log(`Mode:           ${dryRun ? 'DRY RUN (no DB writes)' : 'LIVE (enqueues to outbox)'}`);
  console.log('==================================================\n');

  try {
    const result = await digestService.runDigest({ now, userId, dryRun });
    console.log('--- Digest Run Summary ---');
    console.log(`Users evaluated: ${result.processedUsers}`);
    console.log(`Digests enqueued: ${result.enqueuedCount}`);
    console.log(`Users skipped:   ${result.skippedCount}`);
    console.log('\n✓ Digest run finished successfully.\n');
    process.exit(0);
  } catch (err) {
    console.error('💥 Digest run failed:', err);
    process.exit(1);
  }
}

main();
