#!/usr/bin/env node
'use strict';

/**
 * Demo Data Seeder Script
 * Seeds the application with demo creators, subscribers, and posts.
 * Safety gate: refuses in production unless ALLOW_DEMO_SEED=true.
 */

const { execSync } = require('child_process');
const env = require('../src/config/env');

if (env.NODE_ENV === 'production' && !env.ALLOW_DEMO_SEED) {
  console.error(
    '[SeedDemo] Refused: Cannot seed demo data in production without ALLOW_DEMO_SEED=true'
  );
  process.exit(1);
}

console.log('[SeedDemo] Seeding demo data...');
try {
  execSync('npx sequelize-cli db:seed --seed 20261028000002-seed-demo-data.js', {
    stdio: 'inherit',
    env: process.env
  });
  console.log('[SeedDemo] Demo data seeded successfully.');
} catch (err) {
  console.error('[SeedDemo] Seeding failed:', err.message);
  process.exit(1);
}
