'use strict';

/**
 * CreatorHub v0.7 Automated Firebase Live Metrics Verification Suite
 *
 * Covers:
 * 1. Live subscriber counts & tier breakdown in Firebase Realtime Database
 * 2. Subscription lifecycle transitions (create, upgrade, cancel) mirrored to Firebase
 * 3. Event debouncing & write coalescing (coalesces rapid events into 1 write)
 * 4. Hourly & startup reconciliation (reconcileAllCreators)
 * 5. Creator custom token minting (GET /api/creators/me/firebase-token) & role checks
 * 6. REST dashboard fallback endpoint (GET /api/creators/me/dashboard/subscribers)
 * 7. Side-effect isolation (Firebase failures NEVER fail or roll back REST subscription requests)
 * 8. Realtime Database security rules validation (database.rules.json)
 */

const fs = require('fs');
const path = require('path');
const { spawnServer } = require('./lib/spawnServer');
const { fakeDriver } = require('../src/services/firebase');
const firebaseSyncService = require('../src/services/firebaseSyncService');
const { reconcileAllCreators } = require('../src/jobs/firebaseReconcileJob');
const { subscriptionStore } = require('../src/store');
const { Subscription } = require('../src/models');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASSED: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAILED: ${message}`);
    failed++;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  console.log('\n=== Starting CreatorHub v0.7 Firebase Verification Suite ===\n');

  // Spawn test server with fake Firebase driver and 200ms debounce
  const server = await spawnServer({
    FIREBASE_DRIVER: 'fake',
    STORAGE_DRIVER: 'fake',
    MAIL_DRIVER: 'log',
    FIREBASE_SYNC_DEBOUNCE_MS: '200',
    RATE_LIMIT_ENABLED: 'true'
  });
  const BASE_URL = server.baseUrl;

  try {
    const login = async (email, password = 'Password123!') => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      return { status: res.status, data, token: data.token };
    };

    // HTTP Helpers to inspect and control server's in-memory Firebase driver
    const getFirebaseData = async () => {
      const res = await fetch(`${BASE_URL}/dev/firebase`);
      return res.json();
    };

    const getFirebaseNode = async (pathStr) => {
      const data = await getFirebaseData();
      const segments = pathStr.split('/').filter(Boolean);
      let cur = data.tree;
      for (const seg of segments) {
        if (!cur) return null;
        cur = cur[seg];
      }
      return cur !== undefined ? cur : null;
    };

    const clearServerFirebase = async () => {
      await fetch(`${BASE_URL}/dev/firebase/clear`, { method: 'POST' });
    };

    const simulateServerFailAll = async (fail = true) => {
      await fetch(`${BASE_URL}/dev/firebase/fail-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fail })
      });
    };

    const alice = await login('alice.creator@creatorhub.local');
    const charlie = await login('charlie.creator@creatorhub.local');
    const subC = await login('subc.free@creatorhub.local');
    const subD = await login('subd.cancelled@creatorhub.local');

    // Clean up any existing subscription for Sub C to Alice
    await Subscription.destroy({
      where: { subscriberId: subC.data.user.id, creatorId: alice.data.user.id }
    });

    // =========================================================================
    // SECTION 1: Live Subscriber Metric Synchronization
    // =========================================================================
    console.log('\n--- 1. Testing Live Metrics Synchronization & Lifecycle ---');

    // Initial Alice stats populated by startup reconciliation
    let aliceStats = await getFirebaseNode(`creatorStats/${alice.data.user.id}`);
    assert(aliceStats !== null, 'Alice metrics initialized in Firebase Realtime Database');
    assert(typeof aliceStats.subscriberCount === 'number', 'Metrics contain subscriberCount');
    assert(typeof aliceStats.byTier === 'object', 'Metrics contain byTier breakdown');
    assert(typeof aliceStats.updatedAt === 'number', 'Metrics contain numeric updatedAt timestamp');

    const initialTotal = aliceStats.subscriberCount;

    // Sub C subscribes to Alice Pro
    const subRes = await fetch(`${BASE_URL}/api/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${subC.token}`
      },
      body: JSON.stringify({
        creatorId: alice.data.user.id,
        tier: 'pro'
      })
    });
    assert(subRes.status === 201, 'Sub C subscribed to Alice Pro (201)');

    // Allow debounce window (200ms) to elapse and sync to write
    await sleep(500);

    aliceStats = await getFirebaseNode(`creatorStats/${alice.data.user.id}`);
    assert(
      aliceStats.subscriberCount === initialTotal + 1,
      `Subscriber count incremented to ${initialTotal + 1} in Firebase`
    );

    // Verify MySQL agreement
    const mysqlCounts = await subscriptionStore.countActiveByCreatorGroupedByTier(alice.data.user.id);
    assert(
      aliceStats.subscriberCount === mysqlCounts.total,
      'Firebase subscriber count matches MySQL total active count exactly'
    );
    assert(
      aliceStats.byTier.pro === mysqlCounts.byTier.pro,
      'Firebase byTier.pro matches MySQL active Pro subscriptions'
    );

    // Sub C upgrades to VIP
    const upgradeRes = await fetch(`${BASE_URL}/api/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${subC.token}`
      },
      body: JSON.stringify({
        creatorId: alice.data.user.id,
        tier: 'vip'
      })
    });
    assert(upgradeRes.status === 200, 'Sub C upgraded to Alice VIP (200)');
    await sleep(500);

    aliceStats = await getFirebaseNode(`creatorStats/${alice.data.user.id}`);
    assert(
      aliceStats.subscriberCount === initialTotal + 1,
      'Upgrading tier keeps total subscriber count unchanged'
    );
    assert(
      aliceStats.byTier.vip > 0,
      'Firebase byTier.vip incremented on upgrade'
    );

    // Sub C cancels subscription
    const cancelRes = await fetch(`${BASE_URL}/api/subscriptions/${alice.data.user.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${subC.token}` }
    });
    assert(cancelRes.status === 200, 'Sub C cancelled subscription to Alice (200)');
    await sleep(500);

    aliceStats = await getFirebaseNode(`creatorStats/${alice.data.user.id}`);
    assert(
      aliceStats.subscriberCount === initialTotal,
      'Cancelling subscription decremented total subscriber count back to initial value'
    );

    // =========================================================================
    // SECTION 2: Event Debouncing & Coalescing
    // =========================================================================
    console.log('\n--- 2. Testing Write Debouncing & Coalescing ---');

    fakeDriver.clear();
    const initialWriteCount = fakeDriver.getWriteCount();

    // Trigger 5 rapid debounced sync calls in quick succession (< 50ms) using unit sync service
    for (let i = 0; i < 5; i++) {
      firebaseSyncService.syncCreatorMetrics(charlie.data.user.id, { immediate: false });
    }

    // Immediately check: no writes should have executed yet
    assert(
      fakeDriver.getWriteCount() === initialWriteCount,
      'Immediate write count is unchanged (calls successfully coalesced in debounce buffer)'
    );

    // Wait for debounce window to fire (default 500ms or flushed)
    await firebaseSyncService.flushDebouncedSyncs();

    const deltaWrites = fakeDriver.getWriteCount() - initialWriteCount;
    assert(
      deltaWrites === 1,
      `Rapid burst of 5 sync calls coalesced into exactly 1 Firebase write (actual: ${deltaWrites})`
    );

    // =========================================================================
    // SECTION 3: Reconciliation Job & Resync
    // =========================================================================
    console.log('\n--- 3. Testing Full Database Reconciliation ---');

    fakeDriver.clear();
    await reconcileAllCreators();

    const aliceNode = await fakeDriver.get(`creatorStats/${alice.data.user.id}`);
    const charlieNode = await fakeDriver.get(`creatorStats/${charlie.data.user.id}`);
    assert(aliceNode !== null, 'Reconciliation populated Alice stats');
    assert(charlieNode !== null, 'Reconciliation populated Charlie stats');

    // =========================================================================
    // SECTION 4: Creator Custom Token & Dashboard Endpoints
    // =========================================================================
    console.log('\n--- 4. Testing Creator Custom Token & Dashboard Endpoints ---');

    // 4.1 Creator obtains custom token
    const tokenRes = await fetch(`${BASE_URL}/api/creators/me/firebase-token`, {
      headers: { Authorization: `Bearer ${alice.token}` }
    });
    assert(tokenRes.status === 200, 'Creator GET /api/creators/me/firebase-token returns 200');
    const tokenData = await tokenRes.json();
    assert(typeof tokenData.token === 'string' && tokenData.token.length > 20, 'Response contains valid custom token');
    assert(tokenData.path === `creatorStats/${alice.data.user.id}`, 'Response specifies correct database path');

    // 4.2 Subscriber blocked from obtaining custom token
    const subTokenRes = await fetch(`${BASE_URL}/api/creators/me/firebase-token`, {
      headers: { Authorization: `Bearer ${subC.token}` }
    });
    assert(subTokenRes.status === 403, 'Subscriber GET /api/creators/me/firebase-token returns 403 Forbidden');

    // 4.3 REST Dashboard Fallback Endpoint
    const dashRes = await fetch(`${BASE_URL}/api/creators/me/dashboard/subscribers`, {
      headers: { Authorization: `Bearer ${alice.token}` }
    });
    assert(dashRes.status === 200, 'Creator GET /api/creators/me/dashboard/subscribers returns 200');
    const dashData = await dashRes.json();
    assert(typeof dashData.subscriberCount === 'number', 'Dashboard returns numeric subscriberCount');
    assert(typeof dashData.byTier === 'object', 'Dashboard returns byTier breakdown');

    // 4.4 Non-creator blocked from dashboard endpoint
    const subDashRes = await fetch(`${BASE_URL}/api/creators/me/dashboard/subscribers`, {
      headers: { Authorization: `Bearer ${subC.token}` }
    });
    assert(subDashRes.status === 403, 'Subscriber GET /api/creators/me/dashboard/subscribers returns 403 Forbidden');

    // =========================================================================
    // SECTION 5: Side-Effect Isolation (Hard Rule)
    // =========================================================================
    console.log('\n--- 5. Testing Side-Effect Isolation (Firebase Outage) ---');

    // Simulate catastrophic Firebase outage in server
    await simulateServerFailAll(true);

    // Subscriber subscribes to Charlie Pro -> Must STILL succeed on REST API
    const outageSubRes = await fetch(`${BASE_URL}/api/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${subD.token}`
      },
      body: JSON.stringify({
        creatorId: charlie.data.user.id,
        tier: 'pro'
      })
    });

    assert(
      outageSubRes.status === 200 || outageSubRes.status === 201,
      'Side-Effect Isolation: REST subscription succeeds even when Firebase completely fails'
    );

    // Clear simulated failure in server
    await simulateServerFailAll(false);

    // =========================================================================
    // SECTION 6: Realtime Database Security Rules File
    // =========================================================================
    console.log('\n--- 6. Testing Firebase Security Rules Specification ---');

    const rulesPath = path.resolve(__dirname, '../firebase/database.rules.json');
    assert(fs.existsSync(rulesPath), 'firebase/database.rules.json exists');

    const rulesContent = fs.readFileSync(rulesPath, 'utf8');
    const rules = JSON.parse(rulesContent);
    const creatorRules = rules.rules.creatorStats['$creatorId'];
    assert(
      creatorRules['.read'].includes('auth.uid === $creatorId'),
      'Security Rules: read restricted to matching auth.uid'
    );
    assert(
      creatorRules['.write'] === false,
      'Security Rules: client writes are strictly disabled (.write: false)'
    );

    console.log(`\n================================================================`);
    console.log(`Firebase Verification Completed: ${passed} passed, ${failed} failed`);
    console.log(`================================================================\n`);

    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await server.stop();
  }
}

run().catch((err) => {
  console.error('💥 Unhandled error in verify-firebase.js:', err);
  process.exit(1);
});
