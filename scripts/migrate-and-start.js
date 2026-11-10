#!/usr/bin/env node
'use strict';

/**
 * Container entrypoint script
 * Executes pending database migrations when RUN_MIGRATIONS=true before starting the application server.
 */

const { execSync } = require('child_process');
const env = require('../src/config/env');

async function main() {
  if (env.RUN_MIGRATIONS) {
    console.log('[MigrateAndStart] RUN_MIGRATIONS=true: Executing database migrations...');
    try {
      execSync('npx sequelize-cli db:migrate', {
        stdio: 'inherit',
        env: process.env
      });
      console.log('[MigrateAndStart] Migrations executed successfully.');
    } catch (err) {
      console.error('[MigrateAndStart] Migration failed:', err.message);
      process.exit(1);
    }
  } else {
    console.log('[MigrateAndStart] RUN_MIGRATIONS is not true, skipping migration step.');
  }

  console.log('[MigrateAndStart] Starting CreatorHub server...');
  require('../src/server');
}

main().catch((err) => {
  console.error('[MigrateAndStart] Startup error:', err);
  process.exit(1);
});
