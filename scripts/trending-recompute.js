#!/usr/bin/env node
'use strict';

const trendingService = require('../src/services/trendingService');
const { sequelize } = require('../src/models');

async function main() {
  const args = process.argv.slice(2);
  let now = new Date();

  for (const arg of args) {
    if (arg.startsWith('--now=')) {
      const parsed = new Date(arg.split('=')[1]);
      if (!Number.isNaN(parsed.getTime())) {
        now = parsed;
      } else {
        console.error(`Invalid date for --now: ${arg.split('=')[1]}`);
        process.exit(1);
      }
    }
  }

  console.log('\n==================================================');
  console.log('CreatorHub Trending Recompute CLI');
  console.log(`Reference Date: ${now.toISOString()}`);
  console.log('==================================================\n');

  try {
    const result = await trendingService.computeTrending({ now });
    console.log('--- Trending Recompute Summary ---');
    console.log(`Items ranked: ${result.computedCount}`);
    console.log(`Computed at:  ${result.computedAt.toISOString()}`);
    console.log('\n✓ Trending recomputation finished successfully.\n');
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('💥 Trending recomputation failed:', err);
    await sequelize.close();
    process.exit(1);
  }
}

main();
