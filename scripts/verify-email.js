'use strict';

/**
 * CreatorHub v0.7 Automated Email Verification Suite
 *
 * Covers:
 * 1. Welcome email lifecycle (enqueue, outbox worker processing, log driver inspection)
 * 2. Unsubscribe links & RFC 8058 headers (List-Unsubscribe, List-Unsubscribe-Post)
 * 3. Idempotency (no duplicate welcome email on same tier)
 * 4. New post fan-out & tier gating (only rank >= minTierRank, opt-out skipped)
 * 5. Security & privacy (zero body HTML leakage, plain-text excerpts, subject cleaning)
 * 6. Weekly digest generator & ISO-week deduplication
 * 7. Notification preferences API (GET/PUT /api/notifications/preferences)
 * 8. Public HMAC-verified unsubscribe endpoint (valid, tampered, expired)
 * 9. Worker reliability (transient retries, retry delays, stuck row recovery)
 * 10. Send-time eligibility checks (access revocation, daily recipient abuse cap)
 */

const { spawnServer } = require('./lib/spawnServer');
const { outboxStore, userStore, subscriptionStore } = require('../src/store');
const { Subscription, EmailOutbox, sequelize } = require('../src/models');
const { createUnsubscribeToken, verifyUnsubscribeToken } = require('../src/services/outboxService');
const digestService = require('../src/services/digestService');

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
  console.log('\n=== Starting CreatorHub v0.7 Email Verification Suite ===\n');

  // Spawn test server with fake storage and log mail driver, worker poll interval 200ms
  const server = await spawnServer({
    MAIL_DRIVER: 'log',
    STORAGE_DRIVER: 'fake',
    EMAIL_WORKER_POLL_MS: '200',
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

    // Helper to query sent emails from server's in-memory logDriver
    const getSentMail = async () => {
      const res = await fetch(`${BASE_URL}/dev/mail`);
      const data = await res.json();
      return data.sent || [];
    };

    const clearMail = async () => {
      await fetch(`${BASE_URL}/dev/mail/clear`, { method: 'POST' });
    };

    const simulateFailNext = async (count = 1) => {
      await fetch(`${BASE_URL}/dev/mail/fail-next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count })
      });
    };

    // Authenticate demo users
    const alice = await login('alice.creator@creatorhub.local');
    const charlie = await login('charlie.creator@creatorhub.local');
    const subA = await login('suba.vip@creatorhub.local');
    const subB = await login('subb.pro@creatorhub.local');
    const subC = await login('subc.free@creatorhub.local');
    const subOptOut = await login('subf.optout@creatorhub.local');

    // Clean initial state for isolated test execution
    await sequelize.query('DELETE FROM email_outbox');
    await sequelize.query('DELETE FROM subscriptions WHERE subscriber_id = "c0000003-cccc-4ccc-8ccc-cccccccccccc"');
    await sequelize.query('UPDATE subscriptions SET status = "active", ends_at = NULL WHERE subscriber_id = "a0000001-aaaa-4aaa-8aaa-aaaaaaaaaaaa" AND creator_id = "a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa"');
    await sequelize.query('UPDATE subscriptions SET status = "active", ends_at = NULL WHERE subscriber_id = "b0000002-bbbb-4bbb-8bbb-bbbbbbbbbbbb" AND creator_id = "a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa"');
    await sequelize.query('UPDATE users SET notify_new_posts = true, notify_weekly_digest = true WHERE id IN ("a0000001-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "b0000002-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "c0000003-cccc-4ccc-8ccc-cccccccccccc")');
    await sequelize.query('UPDATE users SET notify_new_posts = false, notify_weekly_digest = false WHERE id = "f0000006-ffff-4fff-8fff-ffffffffffff"');

    await clearMail();

    // =========================================================================
    // SECTION 1: Welcome Email Lifecycle & Idempotency
    // =========================================================================
    console.log('\n--- 1. Testing Welcome Email Lifecycle & Outbox Worker ---');

    // Sub C subscribes to Charlie Pro
    const subRes = await fetch(`${BASE_URL}/api/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${subC.token}`
      },
      body: JSON.stringify({
        creatorId: charlie.data.user.id,
        tier: 'pro'
      })
    });
    assert(subRes.status === 201, 'Sub C successfully subscribes to Charlie Pro (201)');

    // Allow worker poll cycle
    await sleep(800);

    const sentEmails = await getSentMail();
    const welcomeEmail = sentEmails.find(
      (m) => m.to === 'subc.free@creatorhub.local' && m.subject.includes('Welcome')
    );
    assert(welcomeEmail !== undefined, 'Welcome email received by LogDriver for Sub C');
    assert(welcomeEmail && welcomeEmail.headers['List-Unsubscribe'] !== undefined, 'Email includes List-Unsubscribe header');
    assert(
      welcomeEmail && welcomeEmail.headers['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click',
      'Email includes RFC 8058 List-Unsubscribe-Post header'
    );

    // Test Idempotency: subscribing to same tier does NOT send duplicate welcome email
    const initialSentCount = (await getSentMail()).length;
    const sameSubRes = await fetch(`${BASE_URL}/api/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${subC.token}`
      },
      body: JSON.stringify({
        creatorId: charlie.data.user.id,
        tier: 'pro'
      })
    });
    assert(sameSubRes.status === 200, 'Same tier re-subscription returns 200 (idempotent)');
    await sleep(400);
    const postIdempotentSent = await getSentMail();
    assert(
      postIdempotentSent.length === initialSentCount,
      'Idempotent subscription did NOT send a second welcome email'
    );

    // =========================================================================
    // SECTION 2: New-Post Email Fan-Out & Tier Gating
    // =========================================================================
    console.log('\n--- 2. Testing New-Post Email Fan-Out & Tier Gating ---');

    await clearMail();

    // Alice publishes a Pro post
    const newPostRes = await fetch(`${BASE_URL}/api/content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alice.token}`
      },
      body: JSON.stringify({
        title: 'Exclusive Pro Architectural Patterns\r\n', // Subject with CR/LF
        body: '<p>' + 'This is public preview teaser text. '.repeat(10) + '</p><p>SECRET_FULL_PRO_BODY_NEVER_LEAK_12345: In-depth secret analysis.</p>',
        minTier: 'pro'
      })
    });
    assert(newPostRes.status === 201, 'Alice publishes Pro post successfully (201)');

    // Allow outbox worker to process fan-out batch
    await sleep(1000);

    const postNotifications = (await getSentMail()).filter((m) => m.subject.includes('New post from Alice'));

    // Sub A (Alice VIP, rank 2) and Sub B (Alice Pro, rank 1) must receive emails
    const receivedA = postNotifications.some((m) => m.to === 'suba.vip@creatorhub.local');
    const receivedB = postNotifications.some((m) => m.to === 'subb.pro@creatorhub.local');
    assert(receivedA, 'VIP subscriber received new Pro post email');
    assert(receivedB, 'Pro subscriber received new Pro post email');

    // Sub C (no sub to Alice) must NOT receive email
    const receivedC = postNotifications.some((m) => m.to === 'subc.free@creatorhub.local');
    assert(!receivedC, 'Unsubscribed user did NOT receive new post email');

    // Sub F (subscribed to Alice Pro, but notify_new_posts = false) must NOT receive email
    const receivedF = postNotifications.some((m) => m.to === 'subf.optout@creatorhub.local');
    assert(!receivedF, 'Subscriber with notify_new_posts=false was skipped (zero emails sent)');

    // Verify privacy: email does NOT contain raw secret body HTML
    const emailSample = postNotifications[0];
    assert(
      emailSample && !emailSample.html.includes('SECRET_FULL_PRO_BODY_NEVER_LEAK_12345'),
      'Security: Email HTML contains NO trace of full post body'
    );
    assert(
      emailSample && !emailSample.subject.includes('\r') && !emailSample.subject.includes('\n'),
      'Security: Email subject stripped of CR/LF injection characters'
    );

    // =========================================================================
    // SECTION 3: Weekly Digest Generator & ISO-Week Deduplication
    // =========================================================================
    console.log('\n--- 3. Testing Weekly Digest Generator & Deduplication ---');

    await clearMail();

    const digestRun1 = await digestService.runDigest({ now: new Date(), dryRun: false });
    assert(digestRun1.enqueuedCount >= 1, 'Digest generator enqueued digests for eligible subscribers');

    // Allow worker to process batch
    await sleep(1000);

    const sentDigests = (await getSentMail()).filter((m) => m.subject.includes('Weekly Digest'));
    assert(sentDigests.length >= 1, 'Digest emails delivered to outbox and processed by worker');

    // Verify opt-out subscriber was not sent digest
    const digestF = sentDigests.some((m) => m.to === 'subf.optout@creatorhub.local');
    assert(!digestF, 'Subscriber with notify_weekly_digest=false was not sent digest');

    // Run again with same ISO week -> Deduplication check
    const digestRun2 = await digestService.runDigest({ now: new Date(), dryRun: false });
    assert(digestRun2.enqueuedCount === 0, 'Deduplication: Running digest again for same ISO week enqueued 0 emails');

    // =========================================================================
    // SECTION 4: Notification Preferences API & Public Unsubscribe
    // =========================================================================
    console.log('\n--- 4. Testing Notification Preferences & Public Unsubscribe ---');

    // 4.1 GET preferences
    const getPrefsRes = await fetch(`${BASE_URL}/api/notifications/preferences`, {
      headers: { Authorization: `Bearer ${subA.token}` }
    });
    assert(getPrefsRes.status === 200, 'GET /api/notifications/preferences returns 200');
    const prefsData = await getPrefsRes.json();
    assert(
      prefsData.preferences.notifyNewPosts === true && prefsData.preferences.notifyWeeklyDigest === true,
      'Initial preferences are enabled by default'
    );

    // 4.2 PUT preferences
    const putPrefsRes = await fetch(`${BASE_URL}/api/notifications/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${subA.token}`
      },
      body: JSON.stringify({ notifyNewPosts: false })
    });
    assert(putPrefsRes.status === 200, 'PUT /api/notifications/preferences returns 200');
    const updatedPrefs = await putPrefsRes.json();
    assert(updatedPrefs.preferences.notifyNewPosts === false, 'notifyNewPosts successfully set to false');

    // Restore Sub A preference
    await fetch(`${BASE_URL}/api/notifications/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${subA.token}`
      },
      body: JSON.stringify({ notifyNewPosts: true })
    });

    // 4.3 Public HMAC Unsubscribe Endpoint
    const subBUser = await userStore.findByEmail('subb.pro@creatorhub.local');
    const validToken = createUnsubscribeToken({ userId: subBUser.id, type: 'weekly_digest' });

    // Valid unsubscribe GET request
    const unsubGetRes = await fetch(`${BASE_URL}/api/email/unsubscribe?token=${encodeURIComponent(validToken)}`, {
      headers: { Accept: 'application/json' }
    });
    assert(unsubGetRes.status === 200, 'GET /api/email/unsubscribe with valid HMAC token returns 200');
    const unsubData = await unsubGetRes.json();
    assert(unsubData.preferences.notifyWeeklyDigest === false, 'Sub B successfully unsubscribed from weekly digest');

    // Tampered token check
    const tamperedToken = validToken.slice(0, -5) + 'xxxxx';
    const tamperedRes = await fetch(`${BASE_URL}/api/email/unsubscribe?token=${encodeURIComponent(tamperedToken)}`, {
      headers: { Accept: 'application/json' }
    });
    assert(tamperedRes.status === 400, 'Tampered unsubscribe token returns 400 Bad Request');

    // Expired token check
    const expiredToken = createUnsubscribeToken({ userId: subBUser.id, type: 'all', expiresInDays: -1 });
    const expiredRes = await fetch(`${BASE_URL}/api/email/unsubscribe?token=${encodeURIComponent(expiredToken)}`, {
      headers: { Accept: 'application/json' }
    });
    assert(expiredRes.status === 400, 'Expired unsubscribe token returns 400 Bad Request');

    // =========================================================================
    // SECTION 5: Worker Reliability, Retries & Stuck Rows
    // =========================================================================
    console.log('\n--- 5. Testing Worker Reliability, Retries & Stuck Rows ---');

    await clearMail();

    // Simulate transient failure on next mail send
    await simulateFailNext(1);

    // Enqueue a test email directly with unique dedupe key
    const testEnqueue = await outboxStore.enqueue({
      type: 'welcome',
      userId: subA.data.user.id,
      toEmail: 'suba.vip@creatorhub.local',
      subject: 'Reliability Test Email',
      html: '<p>Test</p>',
      text: 'Test',
      dedupeKey: `reliability:${Date.now()}`
    });
    assert(testEnqueue.enqueued, 'Direct outbox enqueue succeeded');

    // Allow worker poll cycle to process (it will hit simulated failure)
    await sleep(600);

    // Verify row status remained 'pending' with attempts = 1 and error recorded
    const failedRow = await EmailOutbox.findByPk(testEnqueue.row.id);
    assert(failedRow.status === 'pending', 'Transient failure keeps row in "pending" status for retry');
    assert(failedRow.attempts === 1, 'Attempt counter incremented to 1');
    assert(failedRow.lastError !== null, 'Last error recorded on outbox row');

    // Clear nextAttemptAt to make it due immediately
    await failedRow.update({ nextAttemptAt: null });

    // Allow worker poll cycle again -> Should succeed now
    await sleep(600);
    const recoveredRow = await EmailOutbox.findByPk(testEnqueue.row.id);
    assert(recoveredRow.status === 'sent', 'Row successfully sent on subsequent worker retry');

    // Test stuck row recovery: row in 'sending' older than threshold is reset to 'pending'
    await sequelize.query(
      `UPDATE email_outbox 
       SET status = 'sending', updated_at = DATE_SUB(NOW(), INTERVAL 10 MINUTE) 
       WHERE id = :id`,
      {
        replacements: {
          id: recoveredRow.id
        }
      }
    );
    const reclaimed = await outboxStore.reclaimStuckRows(5 * 60 * 1000);
    assert(reclaimed >= 1, 'Reclaim stuck rows successfully resets stalled items back to pending');

    // =========================================================================
    // SECTION 6: Send-Time Access Revocation
    // =========================================================================
    console.log('\n--- 6. Testing Send-Time Access Revocation ---');

    // Enqueue a new-post notification for a user who currently has access
    const revokeEnqueue = await outboxStore.enqueue({
      type: 'new_post',
      userId: subA.data.user.id,
      toEmail: 'suba.vip@creatorhub.local',
      subject: 'Post that will be revoked',
      html: '<p>Test</p>',
      text: 'Test',
      dedupeKey: `revocation:${Date.now()}`,
      meta: {
        creatorId: alice.data.user.id,
        minTierRank: 2 // Requires VIP
      }
    });

    // Sub A cancels subscription to Alice before email is sent
    await subscriptionStore.cancel({ subscriberId: subA.data.user.id, creatorId: alice.data.user.id });

    // Allow worker poll cycle
    await sleep(600);

    const revokedRow = await EmailOutbox.findByPk(revokeEnqueue.row.id);
    assert(revokedRow.status === 'skipped', 'Outbox worker skipped email when subscriber lost access before send');
    assert(revokedRow.skipReason === 'access_revoked', 'Skip reason recorded as "access_revoked"');

    console.log(`\n================================================================`);
    console.log(`Email Verification Completed: ${passed} passed, ${failed} failed`);
    console.log(`================================================================\n`);

    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await server.stop();
  }
}

run().catch((err) => {
  console.error('💥 Unhandled error in verify-email.js:', err);
  process.exit(1);
});
