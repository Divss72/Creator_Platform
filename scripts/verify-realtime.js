const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production-min32chars';

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

function createSocket(token = null) {
  const options = {
    transports: ['websocket'],
    autoConnect: true,
    forceNew: true,
    reconnection: false
  };
  if (token !== null) {
    options.auth = { token };
  }
  return io(BASE_URL, options);
}

function waitForConnect(socket, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    if (socket.connected) return resolve();
    const timer = setTimeout(() => reject(new Error('Socket connect timeout')), timeoutMs);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function connectAndExpectError(token, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const s = createSocket(token);
    const timer = setTimeout(() => {
      s.close();
      resolve('TIMEOUT');
    }, timeoutMs);

    s.once('connect_error', (err) => {
      clearTimeout(timer);
      s.close();
      resolve(err.message);
    });
    s.once('connect', () => {
      clearTimeout(timer);
      s.close();
      resolve('CONNECTED');
    });
  });
}

function emitAck(socket, event, payload, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout on emit "${event}"`)), timeoutMs);
    socket.emit(event, payload, (ack) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

function waitForEvent(socket, event, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event "${event}" after ${timeoutMs}ms`));
    }, timeoutMs);

    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runVerification() {
  console.log('\n=== Starting CreatorHub v0.4 Realtime Verification ===\n');

  // Seeded IDs
  const aliceFreePostId = 'c1111111-1111-4111-8111-111111111111';
  const aliceProPostId = 'c2222222-2222-4222-8222-222222222222';
  const aliceVipPostId = 'c3333333-3333-4333-8333-333333333333';
  const charlieProPostId = 'c5555555-5555-4555-8555-555555555555';
  const charlieVipPostId = 'c6666666-6666-4666-8666-666666666666';

  // 1. Authenticate Demo Accounts
  console.log('--- 1. Authenticating Demo Accounts ---');
  const aliceToken = await login('alice.creator@creatorhub.local');
  const charlieToken = await login('charlie.creator@creatorhub.local');
  const subAToken = await login('suba.vip@creatorhub.local');
  const subBToken = await login('subb.pro@creatorhub.local');
  const subCToken = await login('subc.free@creatorhub.local');
  const subDToken = await login('subd.cancelled@creatorhub.local');
  const subEToken = await login('sube.expired@creatorhub.local');
  assert(Boolean(aliceToken && subAToken), 'Successfully authenticated demo accounts');

  // 2. Handshake Authentication Tests
  console.log('\n--- 2. Testing Socket Handshake Authentication ---');
  const anonSocket = createSocket(null);
  await waitForConnect(anonSocket);
  assert(anonSocket.connected, 'Anonymous connection connects successfully without token');
  anonSocket.close();

  const malformedErr = await connectAndExpectError('malformed.jwt.token');
  assert(malformedErr === 'INVALID_TOKEN', `Malformed token rejected with INVALID_TOKEN (got: ${malformedErr})`);

  const expiredToken = jwt.sign({ sub: 'a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'creator' }, JWT_SECRET, {
    expiresIn: '0s'
  });
  const expiredErr = await connectAndExpectError(expiredToken);
  assert(expiredErr === 'TOKEN_EXPIRED', `Expired token rejected with TOKEN_EXPIRED (got: ${expiredErr})`);

  // 3. Joining Rooms & Paywall Enforcement Tests
  console.log('\n--- 3. Testing Room Joining & Paywall Rules ---');
  const anonClient = createSocket(null);
  await waitForConnect(anonClient);

  // Anonymous on Free post
  const anonJoinFree = await emitAck(anonClient, 'post:join', { contentId: aliceFreePostId });
  assert(anonJoinFree.ok === true, 'Anonymous can join FREE post');
  assert(anonJoinFree.data.canComment === false, 'Anonymous cannot comment (canComment: false)');
  assert(typeof anonJoinFree.data.viewerCount === 'number', 'Join ack returns viewerCount');

  // Anonymous on Pro post -> TIER_REQUIRED
  const anonJoinPro = await emitAck(anonClient, 'post:join', { contentId: aliceProPostId });
  assert(anonJoinPro.ok === false && anonJoinPro.error.code === 'TIER_REQUIRED', 'Anonymous locked out of Pro post');
  assert(
    anonJoinPro.error.details && anonJoinPro.error.details.requiredTier === 'pro',
    'TIER_REQUIRED includes requiredTier details'
  );

  // Anonymous on VIP post -> TIER_REQUIRED
  const anonJoinVip = await emitAck(anonClient, 'post:join', { contentId: aliceVipPostId });
  assert(anonJoinVip.ok === false && anonJoinVip.error.code === 'TIER_REQUIRED', 'Anonymous locked out of VIP post');

  // Subscriber C (no active subscription)
  const subCSocket = createSocket(subCToken);
  await waitForConnect(subCSocket);
  const subCJoinFree = await emitAck(subCSocket, 'post:join', { contentId: aliceFreePostId });
  assert(subCJoinFree.ok === true && subCJoinFree.data.canComment === true, 'Subscriber C joins Free post with canComment: true');
  const subCJoinPro = await emitAck(subCSocket, 'post:join', { contentId: aliceProPostId });
  assert(subCJoinPro.ok === false && subCJoinPro.error.code === 'TIER_REQUIRED', 'Subscriber C locked out of Pro post');

  // Subscriber B (Pro to Alice)
  const subBSocket = createSocket(subBToken);
  await waitForConnect(subBSocket);
  const subBJoinPro = await emitAck(subBSocket, 'post:join', { contentId: aliceProPostId });
  assert(subBJoinPro.ok === true && subBJoinPro.data.canComment === true, 'Subscriber B (Pro) joins Alice Pro post');
  const subBJoinVip = await emitAck(subBSocket, 'post:join', { contentId: aliceVipPostId });
  assert(subBJoinVip.ok === false && subBJoinVip.error.code === 'TIER_REQUIRED', 'Subscriber B (Pro) locked out of Alice VIP post');

  // Subscriber A (VIP to Alice)
  const subASocket = createSocket(subAToken);
  await waitForConnect(subASocket);
  const subAJoinAliceVip = await emitAck(subASocket, 'post:join', { contentId: aliceVipPostId });
  assert(subAJoinAliceVip.ok === true && subAJoinAliceVip.data.canComment === true, 'Subscriber A (VIP) joins Alice VIP post');

  // Per-creator isolation: Subscriber A (VIP to Alice) cannot join Charlie Pro post
  const subAJoinCharliePro = await emitAck(subASocket, 'post:join', { contentId: charlieProPostId });
  assert(
    subAJoinCharliePro.ok === false && subAJoinCharliePro.error.code === 'TIER_REQUIRED',
    'Per-creator isolation: Alice VIP subscriber is denied joining Charlie Pro post'
  );

  // Owner access: Alice can join her own VIP post
  const aliceSocket = createSocket(aliceToken);
  await waitForConnect(aliceSocket);
  const aliceJoinOwnVip = await emitAck(aliceSocket, 'post:join', { contentId: aliceVipPostId });
  assert(aliceJoinOwnVip.ok === true && aliceJoinOwnVip.data.canComment === true, 'Alice (Owner) can join her own VIP post');

  // Other creator: Charlie cannot join Alice VIP post
  const charlieSocket = createSocket(charlieToken);
  await waitForConnect(charlieSocket);
  const charlieJoinAliceVip = await emitAck(charlieSocket, 'post:join', { contentId: aliceVipPostId });
  assert(charlieJoinAliceVip.ok === false && charlieJoinAliceVip.error.code === 'TIER_REQUIRED', 'Charlie cannot join Alice VIP post');

  // Cancelled & Expired subscriptions
  const subDSocket = createSocket(subDToken);
  await waitForConnect(subDSocket);
  const subDJoin = await emitAck(subDSocket, 'post:join', { contentId: charlieProPostId });
  assert(subDJoin.ok === false && subDJoin.error.code === 'TIER_REQUIRED', 'Cancelled subscription treated as no subscription');

  const subESocket = createSocket(subEToken);
  await waitForConnect(subESocket);
  const subEJoin = await emitAck(subESocket, 'post:join', { contentId: charlieVipPostId });
  assert(subEJoin.ok === false && subEJoin.error.code === 'TIER_REQUIRED', 'Expired subscription treated as no subscription');

  // Unknown post ID -> NOT_FOUND
  const notFoundJoin = await emitAck(aliceSocket, 'post:join', { contentId: '00000000-0000-0000-0000-000000000000' });
  assert(notFoundJoin.ok === false && notFoundJoin.error.code === 'NOT_FOUND', 'Unknown post ID returns NOT_FOUND');

  // Idempotent join
  const dupJoin = await emitAck(aliceSocket, 'post:join', { contentId: aliceVipPostId });
  assert(dupJoin.ok === true, 'Joining room you are already in is idempotent');

  // 4. Live Comment Broadcasting & Validation
  console.log('\n--- 4. Testing Comments, Broadcasting, and Validation ---');
  // Subscriber A and Alice are both in aliceVipPostId
  const commentText = `Live VIP comment test at ${Date.now()}`;

  const aliceReceivePromise = waitForEvent(aliceSocket, 'comment:new');
  const subAReceivePromise = waitForEvent(subASocket, 'comment:new');

  // Sockets in other rooms should NOT receive this comment
  let otherRoomReceived = false;
  subBSocket.once('comment:new', () => {
    otherRoomReceived = true;
  });

  const commentAck = await emitAck(subASocket, 'comment:create', {
    contentId: aliceVipPostId,
    body: commentText
  });

  assert(commentAck.ok === true, 'VIP comment:create acknowledged successfully');
  assert(commentAck.data.comment.body === commentText, 'Ack contains persisted comment');
  assert(commentAck.data.comment.user.role === 'subscriber', 'Comment user object contains role');
  assert(commentAck.data.comment.user.email === undefined, 'Security: Comment user does NOT contain email');

  const aliceReceived = await aliceReceivePromise;
  assert(aliceReceived.id === commentAck.data.comment.id, 'Comment broadcast arrives at other socket in room (Alice)');

  const subAReceived = await subAReceivePromise;
  assert(subAReceived.id === commentAck.data.comment.id, 'Comment broadcast arrives at sender socket (Subscriber A)');

  await sleep(100);
  assert(otherRoomReceived === false, 'Socket in different room does NOT receive comment:new');

  // History endpoint contains the saved comment
  const histRes = await api(`/api/content/${aliceVipPostId}/comments`, {
    headers: { Authorization: `Bearer ${aliceToken}` }
  });
  assert(histRes.status === 200, 'GET /api/content/:id/comments returns 200');
  const foundInHist = histRes.data.items.some((c) => c.id === commentAck.data.comment.id);
  assert(foundInHist, 'Newly created comment is present in history response');

  // Anonymous user cannot comment
  const anonComment = await emitAck(anonClient, 'comment:create', {
    contentId: aliceFreePostId,
    body: 'Anonymous message attempt'
  });
  assert(anonComment.ok === false && anonComment.error.code === 'UNAUTHENTICATED', 'Anonymous comment rejected with UNAUTHENTICATED');

  // Commenting without joining room -> NOT_IN_ROOM
  const notInRoomComment = await emitAck(subCSocket, 'comment:create', {
    contentId: aliceProPostId,
    body: 'Trying to comment without joining'
  });
  assert(notInRoomComment.ok === false && notInRoomComment.error.code === 'NOT_IN_ROOM', 'Commenting without joining room returns NOT_IN_ROOM');

  // Body validations
  const emptyComment = await emitAck(subASocket, 'comment:create', {
    contentId: aliceVipPostId,
    body: ''
  });
  assert(emptyComment.ok === false && emptyComment.error.code === 'VALIDATION_ERROR', 'Empty comment body rejected with VALIDATION_ERROR');

  const whitespaceComment = await emitAck(subASocket, 'comment:create', {
    contentId: aliceVipPostId,
    body: '     \n  \t  '
  });
  assert(whitespaceComment.ok === false && whitespaceComment.error.code === 'VALIDATION_ERROR', 'Whitespace-only comment rejected with VALIDATION_ERROR');

  const tooLongComment = await emitAck(subASocket, 'comment:create', {
    contentId: aliceVipPostId,
    body: 'x'.repeat(1001)
  });
  assert(tooLongComment.ok === false && tooLongComment.error.code === 'VALIDATION_ERROR', '1001-char comment rejected with VALIDATION_ERROR');

  // Rate limiting burst test: send 20 comments in a burst
  console.log('\n--- Testing Anti-Spam Rate Limiting ---');
  let rateLimitedCount = 0;
  for (let i = 0; i < 20; i++) {
    const res = await emitAck(subASocket, 'comment:create', {
      contentId: aliceVipPostId,
      body: `Burst spam test message ${i}`
    });
    if (!res.ok && res.error.code === 'RATE_LIMITED') {
      rateLimitedCount++;
    }
  }
  assert(rateLimitedCount > 0, `Burst of 20 comments triggers RATE_LIMITED (rate limited count: ${rateLimitedCount})`);

  // Mid-session token expiry test
  console.log('\n--- Testing Mid-Session Token Expiration ---');
  const shortLivedToken = jwt.sign(
    { sub: 'a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', role: 'creator', name: 'Alice Test' },
    JWT_SECRET,
    { expiresIn: '2s' }
  );
  const expiringSocket = createSocket(shortLivedToken);
  await waitForConnect(expiringSocket);
  const joinExpRes = await emitAck(expiringSocket, 'post:join', { contentId: aliceFreePostId });
  assert(joinExpRes.ok === true, 'Expiring socket joins room initially');

  // Wait 2.5 seconds for JWT to expire
  console.log('Waiting 2.5s for token to expire...');
  await sleep(2500);

  const expiredCommentAck = await emitAck(expiringSocket, 'comment:create', {
    contentId: aliceFreePostId,
    body: 'Comment after token expiry'
  });
  assert(
    expiredCommentAck.ok === false && expiredCommentAck.error.code === 'TOKEN_EXPIRED',
    `Comment with mid-session expired token rejected with TOKEN_EXPIRED (got: ${expiredCommentAck.error ? expiredCommentAck.error.code : 'ok'})`
  );
  expiringSocket.close();

  // 5. Distinct Viewer Count Tests
  console.log('\n--- 5. Testing Distinct Viewer Count ---');
  // Create a throwaway post for clean viewer count test
  const postRes = await api('/api/content', {
    method: 'POST',
    headers: { Authorization: `Bearer ${aliceToken}` },
    body: {
      title: 'Viewer Count Test Post',
      body: 'Testing distinct viewer logic across tabs',
      minTier: 'free'
    }
  });
  const testPostId = postRes.data.content.id;

  // Socket 1 (User 1 - Alice tab 1)
  const vc1 = createSocket(aliceToken);
  await waitForConnect(vc1);
  const j1 = await emitAck(vc1, 'post:join', { contentId: testPostId });
  assert(j1.data.viewerCount === 1, 'First user joins -> viewerCount is 1');

  // Socket 2 (User 2 - Subscriber A)
  const vc2 = createSocket(subAToken);
  await waitForConnect(vc2);
  let vcUpdateReceived = false;
  vc1.once('viewers:update', (data) => {
    if (data.contentId === testPostId && data.count === 2) {
      vcUpdateReceived = true;
    }
  });

  const j2 = await emitAck(vc2, 'post:join', { contentId: testPostId });
  assert(j2.data.viewerCount === 2, 'Second distinct user joins -> viewerCount is 2');
  await sleep(100);
  assert(vcUpdateReceived, 'viewers:update event received with count: 2');

  // Socket 3 (User 1 - Alice tab 2: same user, different socket)
  const vc3 = createSocket(aliceToken);
  await waitForConnect(vc3);
  let duplicateCountUpdate = false;
  vc1.once('viewers:update', () => {
    duplicateCountUpdate = true;
  });

  const j3 = await emitAck(vc3, 'post:join', { contentId: testPostId });
  assert(j3.data.viewerCount === 2, 'Same user opening second tab -> viewerCount remains 2 (distinct)');
  await sleep(100);
  assert(duplicateCountUpdate === false, 'viewers:update is NOT emitted when count does not change');

  // User 1 closes first tab
  vc1.close();
  await sleep(100);
  assert(duplicateCountUpdate === false, 'Viewer count stays 2 while user still has second tab open');

  // User 1 closes second tab
  let countDropped = false;
  vc2.once('viewers:update', (data) => {
    if (data.contentId === testPostId && data.count === 1) {
      countDropped = true;
    }
  });
  vc3.close();
  await sleep(100);
  assert(countDropped, 'Viewer count decrements to 1 after user closes last tab');
  vc2.close();

  // 6. Live Revalidation Tests (Throwaway data)
  console.log('\n--- 6. Testing Live Access Revocation ---');
  // Throwaway subscriber registers
  const rand = Math.floor(Math.random() * 100000);
  const regRes = await api('/api/auth/register', {
    method: 'POST',
    body: {
      name: `Revoke Test ${rand}`,
      email: `revoke_${rand}@creatorhub.local`,
      password: 'Password123!',
      role: 'subscriber'
    }
  });
  const revokeUserToken = regRes.data.token;
  const revokeUserId = regRes.data.user.id;

  // Subscribe to Alice Pro
  await api('/api/subscriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${revokeUserToken}` },
    body: { creatorId: 'a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tier: 'pro' }
  });

  const revokeSocket = createSocket(revokeUserToken);
  await waitForConnect(revokeSocket);
  const joinProRes = await emitAck(revokeSocket, 'post:join', { contentId: aliceProPostId });
  assert(joinProRes.ok === true, 'Throwaway subscriber successfully joins Alice Pro room');

  // Cancel subscription over REST
  const revokePromise = waitForEvent(revokeSocket, 'access:revoked');
  const cancelRes = await api('/api/subscriptions/a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${revokeUserToken}` }
  });
  assert(cancelRes.status === 200, 'Subscription cancelled over REST');

  const revokedEvent = await revokePromise;
  assert(
    revokedEvent.contentId === aliceProPostId && revokedEvent.reason === 'SUBSCRIPTION_CHANGED',
    'access:revoked event received immediately upon subscription cancellation'
  );

  // Subsequent comment fails with NOT_IN_ROOM
  const postCancelComment = await emitAck(revokeSocket, 'comment:create', {
    contentId: aliceProPostId,
    body: 'Trying to comment after revocation'
  });
  assert(
    postCancelComment.ok === false && postCancelComment.error.code === 'NOT_IN_ROOM',
    'Subsequent comment after revocation fails with NOT_IN_ROOM'
  );
  revokeSocket.close();

  // Downgrade from VIP to Pro in VIP room
  console.log('\n--- Testing Downgrade Revocation ---');
  const reg2 = await api('/api/auth/register', {
    method: 'POST',
    body: {
      name: `Downgrade Test ${rand}`,
      email: `downgrade_${rand}@creatorhub.local`,
      password: 'Password123!',
      role: 'subscriber'
    }
  });
  const dgToken = reg2.data.token;

  await api('/api/subscriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${dgToken}` },
    body: { creatorId: 'a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tier: 'vip' }
  });

  const dgSocket = createSocket(dgToken);
  await waitForConnect(dgSocket);
  const dgJoin = await emitAck(dgSocket, 'post:join', { contentId: aliceVipPostId });
  assert(dgJoin.ok === true, 'VIP subscriber joins VIP post room');

  const dgRevokePromise = waitForEvent(dgSocket, 'access:revoked');
  await api('/api/subscriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${dgToken}` },
    body: { creatorId: 'a1111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tier: 'pro' }
  });

  const dgRevoked = await dgRevokePromise;
  assert(
    dgRevoked.contentId === aliceVipPostId && dgRevoked.reason === 'SUBSCRIPTION_CHANGED',
    'Downgrading from VIP to Pro revokes access to VIP room'
  );
  dgSocket.close();

  // Owner raising minTier of a post
  console.log('\n--- Testing minTier Raising Revocation ---');
  const freePostRes = await api('/api/content', {
    method: 'POST',
    headers: { Authorization: `Bearer ${aliceToken}` },
    body: {
      title: 'MinTier Update Post',
      body: 'Will be raised to VIP',
      minTier: 'free'
    }
  });
  const dynamicPostId = freePostRes.data.content.id;

  const subCRoomSocket = createSocket(subCToken);
  await waitForConnect(subCRoomSocket);
  const subCJoinDyn = await emitAck(subCRoomSocket, 'post:join', { contentId: dynamicPostId });
  assert(subCJoinDyn.ok === true, 'Free subscriber joins dynamic post while minTier is free');

  const tierChangeRevokePromise = waitForEvent(subCRoomSocket, 'access:revoked');
  await api(`/api/content/${dynamicPostId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${aliceToken}` },
    body: { minTier: 'vip' }
  });

  const tierRevoked = await tierChangeRevokePromise;
  assert(
    tierRevoked.contentId === dynamicPostId && tierRevoked.reason === 'TIER_REQUIREMENT_CHANGED',
    'Raising minTier revokes access for sockets below the new tier'
  );
  subCRoomSocket.close();

  // Owner deleting a post -> post:deleted event
  console.log('\n--- Testing Post Deletion Notification ---');
  const delPostRes = await api('/api/content', {
    method: 'POST',
    headers: { Authorization: `Bearer ${aliceToken}` },
    body: {
      title: 'Delete Test Post',
      body: 'Will be deleted',
      minTier: 'free'
    }
  });
  const delPostId = delPostRes.data.content.id;

  const listenerSocket = createSocket(subAToken);
  await waitForConnect(listenerSocket);
  await emitAck(listenerSocket, 'post:join', { contentId: delPostId });

  const delPromise = waitForEvent(listenerSocket, 'post:deleted');
  await api(`/api/content/${delPostId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${aliceToken}` }
  });

  const delEvent = await delPromise;
  assert(delEvent.contentId === delPostId, 'Deleting post broadcasts post:deleted to room');
  listenerSocket.close();

  // 7. Chat History REST Endpoint Tests
  console.log('\n--- 7. Testing Chat History REST Endpoint ---');
  // Free post history as anonymous
  const anonHist = await api(`/api/content/${aliceFreePostId}/comments?limit=2`);
  assert(anonHist.status === 200, 'Anonymous can read history on FREE post (200 OK)');
  assert(anonHist.data.items.length === 2, 'History paginates with limit (returned 2 items)');
  assert(Boolean(anonHist.data.nextBefore), 'Returns nextBefore cursor ID when more comments exist');

  // Next page using cursor
  const page2Hist = await api(`/api/content/${aliceFreePostId}/comments?limit=2&before=${anonHist.data.nextBefore}`);
  assert(page2Hist.status === 200, 'History pagination with before cursor returns 200 OK');
  assert(page2Hist.data.items.length >= 1, 'Cursor pagination retrieves older items');

  // Verify no duplicate items across pages
  const page1Ids = new Set(anonHist.data.items.map((c) => c.id));
  const hasDupes = page2Hist.data.items.some((c) => page1Ids.has(c.id));
  assert(hasDupes === false, 'No duplicate items across history pages');

  // Locked post history returns 403 TIER_REQUIRED
  const lockedHist = await api(`/api/content/${aliceVipPostId}/comments`, {
    headers: { Authorization: `Bearer ${subCToken}` }
  });
  assert(lockedHist.status === 403, 'Locked post history returns 403 Forbidden');
  assert(lockedHist.data.error.code === 'TIER_REQUIRED', 'Locked post history error code is TIER_REQUIRED');
  assert(
    lockedHist.data.error.details && lockedHist.data.error.details.requiredTier === 'vip',
    'Locked post history includes requiredTier in details'
  );

  // Unknown post returns 404 NOT_FOUND
  const notFoundHist = await api('/api/content/00000000-0000-0000-0000-000000000000/comments');
  assert(notFoundHist.status === 404, 'Unknown content ID returns 404 NOT_FOUND');

  // Clean up any remaining sockets
  anonClient.close();
  subCSocket.close();
  subBSocket.close();
  subASocket.close();
  aliceSocket.close();
  charlieSocket.close();
  subDSocket.close();
  subESocket.close();

  // Summary
  console.log('\n================================================================');
  if (failed === 0) {
    console.log(`🎉 ALL ${passed} REALTIME VERIFICATION CHECKS PASSED! (Failed: 0)`);
  } else {
    console.error(`💥 VERIFICATION COMPLETED WITH ${failed} FAILURES (${passed} passed)`);
    process.exitCode = 1;
  }
  console.log('================================================================\n');
}

runVerification().catch((err) => {
  console.error('\nFatal Verification Exception:', err);
  process.exit(1);
});
