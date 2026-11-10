#!/usr/bin/env node
'use strict';

/**
 * Demo Reset CLI Script
 * Safely removes demo data and re-seeds clean deterministic state.
 *
 * Safety requirements:
 * 1. ALLOW_DEMO_SEED=true
 * 2. DEMO_RESET_CONFIRM=<current_db_name>
 */

const env = require('../src/config/env');
const { sequelize } = require('../src/models');
const { execSync } = require('child_process');

async function main() {
  const currentDbName = env.DB_NAME;
  const allowSeed = env.ALLOW_DEMO_SEED;
  const confirmDb = process.env.DEMO_RESET_CONFIRM || env.DEMO_RESET_CONFIRM;

  console.log('\n==================================================');
  console.log('CreatorHub Demo Reset Safety Guard');
  console.log(`Database:          ${currentDbName}`);
  console.log(`ALLOW_DEMO_SEED:   ${allowSeed}`);
  console.log(`DEMO_RESET_CONFIRM: ${confirmDb}`);
  console.log('==================================================\n');

  if (!allowSeed) {
    console.error('💥 [DemoReset] REFUSED: ALLOW_DEMO_SEED is not true. Aborting demo reset.');
    process.exit(1);
  }

  if (confirmDb !== currentDbName) {
    console.error(
      `💥 [DemoReset] REFUSED: DEMO_RESET_CONFIRM ("${confirmDb}") does not match target database ("${currentDbName}"). Aborting.`
    );
    process.exit(1);
  }

  console.log('[DemoReset] Safety checks passed. Purging demo records (is_demo = true)...');

  try {
    await sequelize.transaction(async (t) => {
      // Find all demo user IDs
      const demoUsers = await sequelize.query('SELECT id FROM users WHERE is_demo = true', {
        type: sequelize.QueryTypes.SELECT,
        transaction: t
      });

      const demoUserIds = demoUsers.map((u) => u.id);

      if (demoUserIds.length > 0) {
        // Find demo content IDs
        const demoContent = await sequelize.query(
          'SELECT id FROM content WHERE creator_id IN (:demoUserIds)',
          { replacements: { demoUserIds }, type: sequelize.QueryTypes.SELECT, transaction: t }
        );
        const demoContentIds = demoContent.map((c) => c.id);

        if (demoContentIds.length > 0) {
          await sequelize.query(
            'DELETE FROM content_trending WHERE content_id IN (:demoContentIds)',
            {
              replacements: { demoContentIds },
              transaction: t
            }
          );
          await sequelize.query(
            'DELETE FROM content_reactions WHERE content_id IN (:demoContentIds)',
            {
              replacements: { demoContentIds },
              transaction: t
            }
          );
          await sequelize.query('DELETE FROM comments WHERE content_id IN (:demoContentIds)', {
            replacements: { demoContentIds },
            transaction: t
          });
          await sequelize.query(
            'DELETE FROM content_view_dedupe WHERE content_id IN (:demoContentIds)',
            {
              replacements: { demoContentIds },
              transaction: t
            }
          );
          await sequelize.query(
            'DELETE FROM content_daily_stats WHERE content_id IN (:demoContentIds)',
            {
              replacements: { demoContentIds },
              transaction: t
            }
          );
          await sequelize.query('DELETE FROM media WHERE content_id IN (:demoContentIds)', {
            replacements: { demoContentIds },
            transaction: t
          });
          await sequelize.query('DELETE FROM content WHERE id IN (:demoContentIds)', {
            replacements: { demoContentIds },
            transaction: t
          });
        }

        await sequelize.query(
          'DELETE FROM creator_daily_stats WHERE creator_id IN (:demoUserIds)',
          {
            replacements: { demoUserIds },
            transaction: t
          }
        );
        await sequelize.query(
          'DELETE FROM subscription_events WHERE creator_id IN (:demoUserIds) OR subscriber_id IN (:demoUserIds)',
          { replacements: { demoUserIds }, transaction: t }
        );
        await sequelize.query(
          'DELETE FROM subscriptions WHERE creator_id IN (:demoUserIds) OR subscriber_id IN (:demoUserIds)',
          { replacements: { demoUserIds }, transaction: t }
        );
        await sequelize.query('DELETE FROM creator_profiles WHERE user_id IN (:demoUserIds)', {
          replacements: { demoUserIds },
          transaction: t
        });
        await sequelize.query('DELETE FROM users WHERE id IN (:demoUserIds)', {
          replacements: { demoUserIds },
          transaction: t
        });
      }
    });

    console.log('[DemoReset] Purged existing demo data cleanly. Re-running demo seeder...');
    execSync('node scripts/seed-demo.js', { stdio: 'inherit', env: process.env });

    console.log('\n✓ Demo data reset and re-seeded successfully.\n');
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('💥 [DemoReset] Failed:', err.message);
    await sequelize.close();
    process.exit(1);
  }
}

main();
