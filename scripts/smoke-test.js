#!/usr/bin/env node
'use strict';

/**
 * Smoke Test Script (Read-Only)
 * Verifies that a deployed instance is responding correctly to critical read-only endpoints.
 * Usage: node scripts/smoke-test.js [BASE_URL]
 */

const baseUrl = (process.argv[2] || process.env.APP_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');

async function runSmokeTests() {
  console.log(`[SmokeTest] Starting verification against: ${baseUrl}\n`);
  let failures = 0;

  async function check(name, path, validateFn) {
    const url = `${baseUrl}${path}`;
    process.stdout.write(` - Checking ${name} (${path})... `);
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json, text/html' } });
      const pass = await validateFn(res);
      if (pass) {
        console.log('PASSED');
      } else {
        console.log(`FAILED (HTTP ${res.status})`);
        failures++;
      }
    } catch (err) {
      console.log(`FAILED (${err.message})`);
      failures++;
    }
  }

  // 1. Health check
  await check('Health Endpoint', '/health', async (res) => {
    if (res.status !== 200) return false;
    const data = await res.json();
    return data.status === 'ok' && data.db === 'up';
  });

  // 2. Version masked from public
  await check('Version Endpoint Obfuscation', '/version', async (res) => {
    return res.status === 404;
  });

  // 3. Public feed returns 200
  await check('Public Content Feed', '/api/content?limit=5', async (res) => {
    if (res.status !== 200) return false;
    const data = await res.json();
    return Array.isArray(data.items);
  });

  // 4. Unknown endpoint returns JSON 404
  await check('404 Handling', '/api/nonexistent-route-for-testing', async (res) => {
    if (res.status !== 404) return false;
    const data = await res.json();
    return data.error && data.error.code === 'NOT_FOUND';
  });

  console.log(`\n[SmokeTest] Finished: ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECKS FAILED`}`);
  if (failures > 0) {
    process.exit(1);
  }
}

runSmokeTests().catch((err) => {
  console.error('[SmokeTest] Fatal error:', err);
  process.exit(1);
});

