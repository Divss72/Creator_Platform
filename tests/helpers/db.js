'use strict';

const { sequelize } = require('../../src/models');

/**
 * Truncate all non-reference application tables.
 * Preserves reference seed data (tiers).
 */
async function resetDb() {
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  const tables = [
    'content_trending',
    'creator_daily_stats',
    'subscription_events',
    'content_daily_stats',
    'content_view_dedupe',
    'content_reactions',
    'comments',
    'media',
    'email_outbox',
    'subscriptions',
    'content',
    'creator_profiles',
    'users'
  ];

  for (const table of tables) {
    try {
      await sequelize.query(`TRUNCATE TABLE \`${table}\``);
    } catch (_err) {
      await sequelize.query(`DELETE FROM \`${table}\``);
    }
  }

  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
}

module.exports = { resetDb };
