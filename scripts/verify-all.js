'use strict';

/**
 * CreatorHub Unified Test & Verification Runner
 * Runs all version suites in sequence:
 * 1. Database Model Associations (v0.2)
 * 2. Subscription Paywall & Access Control (v0.3)
 * 3. Socket.io Realtime Chat & Gated Rooms (v0.4)
 * 4. GraphQL Feed & Keyset Pagination (v0.5)
 * 5. Media Uploads & Driver Isolation (v0.6)
 * 6. Security Hardening & Rate Limiting (v0.6)
 */

const { spawn } = require('child_process');
const path = require('path');
const { spawnServer } = require('./lib/spawnServer');

const suites = [
  {
    name: 'Model Associations (v0.2)',
    script: 'scripts/verify-associations.js',
    needsServer: false
  },
  {
    name: 'Subscriptions & Paywall (v0.3)',
    script: 'scripts/verify-paywall.js',
    needsServer: true
  },
  {
    name: 'Realtime Sockets & Chat (v0.4)',
    script: 'scripts/verify-realtime.js',
    needsServer: true
  },
  {
    name: 'GraphQL Feed & Pagination (v0.5)',
    script: 'scripts/verify-graphql.js',
    needsServer: true
  },
  { name: 'Media Uploads & Storage (v0.6)', script: 'scripts/verify-media.js', needsServer: false },
  { name: 'Security & Hardening (v0.6)', script: 'scripts/verify-security.js', needsServer: false },
  {
    name: 'Email Notifications & Outbox (v0.7)',
    script: 'scripts/verify-email.js',
    needsServer: false
  },
  { name: 'Firebase Live Metrics (v0.7)', script: 'scripts/verify-firebase.js', needsServer: false }
];

function runScript(scriptPath, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [path.resolve(__dirname, '..', scriptPath)], {
      env: {
        ...process.env,
        ...extraEnv
      },
      stdio: 'inherit'
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Suite failed with exit code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

async function runAll() {
  console.log('\n================================================================');
  console.log('🚀 Running CreatorHub Full Platform Verification Suite');
  console.log('================================================================\n');

  // 1. Reset database to guaranteed clean state
  console.log('[Setup] Resetting and seeding database...');
  await runScript('scripts/db-drop.js');
  await runScript('scripts/db-create.js');
  await new Promise((resolve, reject) => {
    const migrate = spawn('npx', ['sequelize-cli', 'db:migrate'], {
      stdio: 'inherit',
      shell: true
    });
    migrate.on('close', (c) => (c === 0 ? resolve() : reject(new Error('Migration failed'))));
  });
  await new Promise((resolve, reject) => {
    const seed = spawn('npx', ['sequelize-cli', 'db:seed:all'], { stdio: 'inherit', shell: true });
    seed.on('close', (c) => (c === 0 ? resolve() : reject(new Error('Seeding failed'))));
  });

  // 2. Spawn shared test server for v0.3, v0.4, v0.5 suites
  console.log('\n[Setup] Spawning test server for REST/Realtime/GraphQL suites...');
  const sharedServer = await spawnServer({
    RATE_LIMIT_ENABLED: 'false',
    STORAGE_DRIVER: 'fake'
  });
  const BASE_URL = sharedServer.baseUrl;

  let totalPassedSuites = 0;

  try {
    for (const suite of suites) {
      console.log(`\n----------------------------------------------------------------`);
      console.log(`▶ Running Suite: ${suite.name}`);
      console.log(`----------------------------------------------------------------\n`);

      const extraEnv = suite.needsServer ? { BASE_URL, TEST_BASE_URL: BASE_URL } : {};
      await runScript(suite.script, extraEnv);
      totalPassedSuites++;
      console.log(`\n✨ Suite "${suite.name}" completed successfully.`);
    }

    console.log('\n================================================================');
    console.log(`🎉 ALL ${totalPassedSuites}/${suites.length} TEST SUITES PASSED CLEANLY!`);
    console.log('================================================================\n');
  } catch (err) {
    console.error(`\n❌ VERIFICATION RUNNER FAILED:`, err.message);
    process.exitCode = 1;
  } finally {
    await sharedServer.stop();
  }
}

runAll();
