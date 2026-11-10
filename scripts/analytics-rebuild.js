#!/usr/bin/env node
'use strict';

const rollupService = require('../src/services/rollupService');
const { toUtcDateString } = require('../src/services/math/series');
const { sequelize } = require('../src/models');

async function main() {
  const args = process.argv.slice(2);
  let fromDate = null;
  let toDate = null;
  let creatorId = null;

  for (const arg of args) {
    if (arg.startsWith('--from=')) {
      fromDate = arg.split('=')[1];
    } else if (arg.startsWith('--to=')) {
      toDate = arg.split('=')[1];
    } else if (arg.startsWith('--creator=')) {
      creatorId = arg.split('=')[1];
    }
  }

  // Defaults: past 30 days up to yesterday
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  if (!toDate) toDate = toUtcDateString(yesterday);
  if (!fromDate) fromDate = toUtcDateString(thirtyDaysAgo);

  console.log('\n==================================================');
  console.log('CreatorHub Analytics Rollup Rebuild CLI');
  console.log(`From Date:  ${fromDate}`);
  console.log(`To Date:    ${toDate}`);
  console.log(`Creator:    ${creatorId || 'ALL creators'}`);
  console.log('==================================================\n');

  try {
    const result = await rollupService.processRollups({ fromDate, toDate, creatorId });
    console.log('--- Rollup Rebuild Summary ---');
    console.log(`Creators processed: ${result.processedCreators}`);
    console.log(`Days processed:     ${result.daysCount}`);
    console.log('\n✓ Analytics rebuild completed successfully.\n');
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('💥 Analytics rebuild failed:', err);
    await sequelize.close();
    process.exit(1);
  }
}

main();
