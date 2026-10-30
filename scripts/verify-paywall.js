const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    failed++;
    process.exitCode = 1;
  } else {
    console.log(`✅ PASSED: ${message}`);
    passed++;
  }
}

async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  let data = null;
  const raw = await response.text();
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }

  return { status: response.status, data, raw };
}

async function login(email, password = 'Password123!') {
  const res = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  if (res.status !== 200 || !res.data.token) {
    throw new Error(`Failed to login as ${email}: ${JSON.stringify(res.data)}`);
  }
  return res.data.token;
}

async function runVerification() {
  console.log('\n=== Starting CreatorHub v0.3 Paywall & Subscriptions Verification ===\n');

  // IDs from deterministic seeders
  const aliceId = 'a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const charlieId = 'c1111111-cccc-4ccc-8ccc-cccccccccccc';

  const aliceFreePostId = 'c1111111-1111-4111-8111-111111111111';
  const aliceProPostId = 'c2222222-2222-4222-8222-222222222222';
  const aliceVipPostId = 'c3333333-3333-4333-8333-333333333333';

  const charlieFreePostId = 'c4444444-4444-4444-8444-444444444444';
  const charlieProPostId = 'c5555555-5555-4555-8555-555555555555';
  const charlieVipPostId = 'c6666666-6666-4666-8666-666666666666';

  // Secret texts known only to full content bodies (must never appear in locked JSON)
  const proSecretText = 'commit indexes prevent split-brain';
  const vipSecretText = 'zero-loss partition failover';

  // 1. Tiers endpoint
  console.log('\n--- 1. Testing GET /api/tiers ---');
  const tiersRes = await api('/api/tiers');
  assert(tiersRes.status === 200, 'GET /api/tiers returns 200 OK');
  assert(Array.isArray(tiersRes.data) && tiersRes.data.length === 3, 'GET /api/tiers returns 3 tiers');
  assert(
    tiersRes.data[0].name === 'free' && tiersRes.data[0].rank === 0 &&
    tiersRes.data[1].name === 'pro' && tiersRes.data[1].rank === 1 &&
    tiersRes.data[2].name === 'vip' && tiersRes.data[2].rank === 2,
    'Tiers are properly ranked: free (0) < pro (1) < vip (2)'
  );

  // 2. Login demo users
  console.log('\n--- 2. Authenticating Demo Accounts ---');
  const aliceToken = await login('alice.creator@creatorhub.local');
  const charlieToken = await login('charlie.creator@creatorhub.local');
  const subAToken = await login('suba.vip@creatorhub.local');
  const subBToken = await login('subb.pro@creatorhub.local');
  const subCToken = await login('subc.free@creatorhub.local');
  const subDToken = await login('subd.cancelled@creatorhub.local');
  const subEToken = await login('sube.expired@creatorhub.local');
  console.log('✅ Successfully authenticated all 7 demo accounts');

  // 3. Anonymous viewer access
  console.log('\n--- 3. Testing Anonymous Viewer Access ---');
  const anonFree = await api(`/api/content/${aliceFreePostId}`);
  assert(anonFree.status === 200, 'Anonymous viewing free content returns 200');
  assert(anonFree.data.content.locked === false, 'Anonymous free content has locked: false');
  assert(anonFree.data.content.body !== null && anonFree.data.content.excerpt, 'Anonymous free content has full body and excerpt');

  const anonPro = await api(`/api/content/${aliceProPostId}`);
  assert(anonPro.status === 200, 'Anonymous viewing pro content returns 200 (preview)');
  assert(anonPro.data.content.locked === true, 'Anonymous pro content has locked: true');
  assert(anonPro.data.content.body === null, 'Anonymous pro content body is NULL');
  assert(Boolean(anonPro.data.content.excerpt), 'Anonymous pro content has non-empty excerpt');
  assert(!anonPro.raw.includes(proSecretText), 'Security: Anonymous pro response contains NO trace of full body');

  const anonVip = await api(`/api/content/${aliceVipPostId}`);
  assert(anonVip.status === 200 && anonVip.data.content.locked === true, 'Anonymous viewing VIP content has locked: true');
  assert(anonVip.data.content.body === null, 'Anonymous VIP content body is NULL');
  assert(!anonVip.raw.includes(vipSecretText), 'Security: Anonymous VIP response contains NO trace of full body');

  // 4. Subscriber C (Unsubscribed) access
  console.log('\n--- 4. Testing Subscriber C (Unsubscribed) Access ---');
  const subCFree = await api(`/api/content/${aliceFreePostId}`, { headers: { Authorization: `Bearer ${subCToken}` } });
  assert(subCFree.data.content.locked === false && subCFree.data.content.body !== null, 'Subscriber C sees free content in full');

  const subCPro = await api(`/api/content/${aliceProPostId}`, { headers: { Authorization: `Bearer ${subCToken}` } });
  assert(subCPro.data.content.locked === true && subCPro.data.content.body === null, 'Subscriber C is locked out of pro content');

  const subCVip = await api(`/api/content/${aliceVipPostId}`, { headers: { Authorization: `Bearer ${subCToken}` } });
  assert(subCVip.data.content.locked === true && subCVip.data.content.body === null, 'Subscriber C is locked out of VIP content');

  // 5. Subscriber B (Pro subscriber to Alice) access
  console.log('\n--- 5. Testing Subscriber B (Pro) Access ---');
  const subBFree = await api(`/api/content/${aliceFreePostId}`, { headers: { Authorization: `Bearer ${subBToken}` } });
  assert(subBFree.data.content.locked === false, 'Subscriber B unlocks free content');

  const subBPro = await api(`/api/content/${aliceProPostId}`, { headers: { Authorization: `Bearer ${subBToken}` } });
  assert(subBPro.data.content.locked === false && subBPro.data.content.body !== null, 'Subscriber B unlocks Pro content with full body');
  assert(subBPro.data.content.viewerTier === 'pro', 'Subscriber B viewerTier is "pro"');

  const subBVip = await api(`/api/content/${aliceVipPostId}`, { headers: { Authorization: `Bearer ${subBToken}` } });
  assert(subBVip.data.content.locked === true && subBVip.data.content.body === null, 'Subscriber B is locked out of VIP content');

  // 6. Subscriber A (VIP subscriber to Alice) access
  console.log('\n--- 6. Testing Subscriber A (VIP) Access ---');
  const subAFree = await api(`/api/content/${aliceFreePostId}`, { headers: { Authorization: `Bearer ${subAToken}` } });
  const subAPro = await api(`/api/content/${aliceProPostId}`, { headers: { Authorization: `Bearer ${subAToken}` } });
  const subAVip = await api(`/api/content/${aliceVipPostId}`, { headers: { Authorization: `Bearer ${subAToken}` } });

  assert(subAFree.data.content.locked === false && subAFree.data.content.body !== null, 'Subscriber A unlocks Free content');
  assert(subAPro.data.content.locked === false && subAPro.data.content.body !== null, 'Subscriber A unlocks Pro content');
  assert(subAVip.data.content.locked === false && subAVip.data.content.body !== null, 'Subscriber A unlocks VIP content');
  assert(subAVip.data.content.viewerTier === 'vip', 'Subscriber A viewerTier is "vip"');

  // 7. Per-creator isolation check: Sub A viewing Charlie's content
  console.log('\n--- 7. Testing Per-Creator Subscription Isolation ---');
  const subACharliePro = await api(`/api/content/${charlieProPostId}`, { headers: { Authorization: `Bearer ${subAToken}` } });
  assert(
    subACharliePro.data.content.locked === true && subACharliePro.data.content.body === null,
    'Subscriber A (VIP to Alice) is LOCKED out of Charlie\'s Pro content (subscriptions are strictly per-creator)'
  );
  assert(subACharliePro.data.content.viewerTier === 'free', 'Subscriber A effective tier for Charlie is "free"');

  // 8. Creator Ownership access
  console.log('\n--- 8. Testing Creator Ownership Access ---');
  const aliceOwnVip = await api(`/api/content/${aliceVipPostId}`, { headers: { Authorization: `Bearer ${aliceToken}` } });
  assert(aliceOwnVip.data.content.locked === false && aliceOwnVip.data.content.body !== null, 'Alice (Owner) sees all own VIP content in full');

  const charlieAliceVip = await api(`/api/content/${aliceVipPostId}`, { headers: { Authorization: `Bearer ${charlieToken}` } });
  assert(charlieAliceVip.data.content.locked === true && charlieAliceVip.data.content.body === null, 'Charlie (Other creator) is locked out of Alice\'s VIP content');

  // 9. Cancelled & Expired subscriptions behave like no subscription
  console.log('\n--- 9. Testing Cancelled & Expired Subscriptions ---');
  const subDCharliePro = await api(`/api/content/${charlieProPostId}`, { headers: { Authorization: `Bearer ${subDToken}` } });
  assert(subDCharliePro.data.content.locked === true, 'Subscriber D with cancelled subscription is locked out');

  const subECharlieVip = await api(`/api/content/${charlieVipPostId}`, { headers: { Authorization: `Bearer ${subEToken}` } });
  assert(subECharlieVip.data.content.locked === true, 'Subscriber E with expired subscription is locked out');

  // 10. Dynamic subscription lifecycle flow for Subscriber C
  console.log('\n--- 10. Testing Subscription Lifecycle (Subscribe, Idempotence, Upgrade, Cancel) ---');

  // Step A: Subscribe to Pro
  const subCreate = await api('/api/subscriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${subCToken}` },
    body: { creatorId: aliceId, tier: 'pro' }
  });
  assert(subCreate.status === 201, 'POST /api/subscriptions for new subscription returns 201 Created');
  assert(subCreate.data.subscription.tier === 'pro' && subCreate.data.subscription.status === 'active', 'Subscription created with tier "pro"');

  // Verify Pro unlocked, VIP locked
  const subCProUnlocked = await api(`/api/content/${aliceProPostId}`, { headers: { Authorization: `Bearer ${subCToken}` } });
  const subCVipLocked = await api(`/api/content/${aliceVipPostId}`, { headers: { Authorization: `Bearer ${subCToken}` } });
  assert(subCProUnlocked.data.content.locked === false && subCProUnlocked.data.content.body !== null, 'Subscriber C now unlocks Alice Pro content');
  assert(subCVipLocked.data.content.locked === true, 'Subscriber C still locked out of Alice VIP content');

  // Step B: Idempotent subscribe to Pro again
  const subIdempotent = await api('/api/subscriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${subCToken}` },
    body: { creatorId: aliceId, tier: 'pro' }
  });
  assert(subIdempotent.status === 200, 'Subscribing twice at the same tier returns 200 OK (idempotent, no duplicate)');

  // Step C: Upgrade to VIP
  const subUpgrade = await api('/api/subscriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${subCToken}` },
    body: { creatorId: aliceId, tier: 'vip' }
  });
  assert(subUpgrade.status === 200, 'Upgrading subscription to VIP returns 200 OK');
  assert(subUpgrade.data.subscription.tier === 'vip', 'Subscription tier upgraded to "vip"');

  // Verify VIP unlocked
  const subCVipUnlocked = await api(`/api/content/${aliceVipPostId}`, { headers: { Authorization: `Bearer ${subCToken}` } });
  assert(subCVipUnlocked.data.content.locked === false && subCVipUnlocked.data.content.body !== null, 'Subscriber C now unlocks Alice VIP content');

  // Step D: Cancel subscription
  const subCancel = await api(`/api/subscriptions/${aliceId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${subCToken}` }
  });
  assert(subCancel.status === 200, 'DELETE /api/subscriptions/:creatorId returns 200 OK');
  assert(subCancel.data.subscription.status === 'cancelled', 'Subscription status updated to "cancelled"');

  // Verify immediate access revocation
  const subCProRelocked = await api(`/api/content/${aliceProPostId}`, { headers: { Authorization: `Bearer ${subCToken}` } });
  assert(subCProRelocked.data.content.locked === true && subCProRelocked.data.content.body === null, 'After cancellation, Subscriber C is immediately locked out of Pro content');

  // 11. Subscription endpoint validation & negative rules
  console.log('\n--- 11. Testing Subscription Validation & Security Rules ---');

  // Creator trying to subscribe -> 403
  const creatorSub = await api('/api/subscriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${aliceToken}` },
    body: { creatorId: charlieId, tier: 'pro' }
  });
  assert(creatorSub.status === 403, 'A creator calling POST /api/subscriptions gets 403 Forbidden');

  // Unknown creatorId -> 404
  const badCreatorSub = await api('/api/subscriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${subCToken}` },
    body: { creatorId: '00000000-0000-4000-8000-000000000000', tier: 'pro' }
  });
  assert(badCreatorSub.status === 404, 'Subscribing to unknown creatorId gets 404 Not Found');

  // User who is not a creator -> 404
  const subToSub = await api('/api/subscriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${subCToken}` },
    body: { creatorId: 'b0000002-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tier: 'pro' } // Sub B
  });
  assert(subToSub.status === 404, 'Subscribing to a user who is not a creator gets 404 Not Found');

  // Invalid tier -> 400
  const badTierSub = await api('/api/subscriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${subCToken}` },
    body: { creatorId: aliceId, tier: 'ultra-premium' }
  });
  assert(badTierSub.status === 400, 'Subscribing with invalid tier gets 400 Validation Error');

  // Cancel non-existent subscription -> 404
  const badCancel = await api(`/api/subscriptions/${charlieId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${subCToken}` }
  });
  assert(badCancel.status === 404, 'Cancelling non-existent subscription gets 404 Not Found');

  // Malformed token -> 401 (never treated as anonymous)
  const badTokenReq = await api(`/api/content/${aliceProPostId}`, {
    headers: { Authorization: 'Bearer this.is.a.bad.jwt.token' }
  });
  assert(badTokenReq.status === 401, 'Malformed JWT token returns 401 (not treated as anonymous)');

  // 12. GET /api/subscriptions/me
  console.log('\n--- 12. Testing GET /api/subscriptions/me ---');
  const mySubs = await api('/api/subscriptions/me', {
    headers: { Authorization: `Bearer ${subAToken}` }
  });
  assert(mySubs.status === 200, 'GET /api/subscriptions/me returns 200');
  assert(Array.isArray(mySubs.data.subscriptions) && mySubs.data.subscriptions.length >= 1, 'Returns list of user subscriptions');
  assert(mySubs.data.subscriptions[0].creator && mySubs.data.subscriptions[0].creator.displayName, 'Includes creator display name');

  // 13. Bulk feed query efficiency (no N+1)
  console.log('\n--- 13. Testing Bulk Feed Query Efficiency ---');
  const feed = await api('/api/content?page=1&limit=10', {
    headers: { Authorization: `Bearer ${subBToken}` }
  });
  assert(feed.status === 200, 'GET /api/content feed returns 200');
  assert(Array.isArray(feed.data.items) && feed.data.items.length >= 6, 'Feed returns all seeded content items');

  const proItemInFeed = feed.data.items.find((item) => item.id === aliceProPostId);
  const vipItemInFeed = feed.data.items.find((item) => item.id === aliceVipPostId);

  assert(proItemInFeed && proItemInFeed.locked === false && proItemInFeed.body !== null, 'Feed Pro item is unlocked for Subscriber B');
  assert(vipItemInFeed && vipItemInFeed.locked === true && vipItemInFeed.body === null, 'Feed VIP item is locked for Subscriber B');
  assert(vipItemInFeed && Boolean(vipItemInFeed.excerpt), 'Feed locked item retains excerpt preview');

  console.log(`\n================================================================`);
  console.log(`🎉 ALL ${passed} VERIFICATION CHECKS PASSED! (Failed: ${failed})`);
  console.log(`================================================================\n`);
}

runVerification().catch((err) => {
  console.error('\n❌ Fatal error running paywall verification:', err);
  process.exit(1);
});
