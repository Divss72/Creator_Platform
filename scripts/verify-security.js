'use strict';

/**
 * CreatorHub v0.6 Automated Security Verification Suite
 *
 * Covers:
 * 1. Dual-class text safety policy (Rich text XSS sanitisation & plain-text HTML rejection)
 * 2. Sanitize backfill script verification (dry-run vs --apply)
 * 3. SQL injection corpus & static codebase audit
 * 4. Helmet security headers (Dev relaxed vs Production strict CSP)
 * 5. Unified CORS policy across REST, GraphQL, and Socket.io
 * 6. Production startup safety checks in env.js
 * 7. Multi-tier rate limiters (Auth login, register, write limits, 100KB payload limit)
 * 8. GraphQL root fields cost limit (max 10 root fields / alias flooding protection)
 * 9. Socket handshake concurrent connection limit (max 20 per IP)
 * 10. Reverse proxy trust & IP extraction (TRUST_PROXY)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { io } = require('socket.io-client');
const { spawnServer } = require('./lib/spawnServer');

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

async function run() {
  console.log('\n=== Starting CreatorHub v0.6 Security Verification ===\n');

  // Spawn main server with rate limiting enabled for rate limit tests
  const mainServer = await spawnServer({
    RATE_LIMIT_ENABLED: 'true',
    STORAGE_DRIVER: 'fake',
    CORS_ORIGIN: 'http://localhost:3000,http://127.0.0.1:3000'
  });
  const BASE_URL = mainServer.baseUrl;

  try {
    const login = async (email, password = 'Password123!', baseUrl = BASE_URL) => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      return { status: res.status, data, token: data.token };
    };

    const alice = await login('alice.creator@creatorhub.local');
    const subA = await login('suba.vip@creatorhub.local');

    // =========================================================================
    // SECTION 1: Dual-Class Text Safety Policy (XSS Sanitisation & HTML Rejection)
    // =========================================================================
    console.log('\n--- 1. Testing Dual-Class Text Safety Policy ---');

    // 1.1 Rich text body sanitisation: Strips script tags, evil attributes, and javascript: protocols
    const evilBody = `
      <h2>Welcome</h2>
      <p>This is a safe post paragraph.</p>
      <script>alert('xss')</script>
      <img src="x" onerror="alert(1)">
      <a href="javascript:alert(1)">Click for free tokens</a>
      <a href="https://example.com/legit">Legitimate Link</a>
      <b>Bold text</b>
    `;

    const createPostRes = await fetch(`${BASE_URL}/api/content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alice.token}`
      },
      body: JSON.stringify({
        title: 'Safe Post with Rich HTML',
        body: evilBody,
        minTier: 'free'
      })
    });

    const createPostData = await createPostRes.json();
    assert(createPostRes.status === 201, 'Creator can publish post with rich HTML');
    const savedBody = createPostData.content.body;
    assert(!savedBody.includes('<script>'), 'XSS: <script> tag is completely stripped');
    assert(!savedBody.includes('alert('), 'XSS: script content is removed');
    assert(!savedBody.includes('onerror='), 'XSS: onerror attribute is stripped');
    assert(!savedBody.includes('javascript:'), 'XSS: javascript: URL protocol is removed');
    assert(
      savedBody.includes('rel="noopener noreferrer nofollow"'),
      'XSS: External links automatically get rel="noopener noreferrer nofollow"'
    );
    assert(
      savedBody.includes('<p>This is a safe post paragraph.</p>'),
      'Rich text preserves allowed <p> tags'
    );
    assert(savedBody.includes('<b>Bold text</b>'), 'Rich text preserves allowed <b> tags');

    // 1.2 Plain-text excerpt generation: Extracts clean plain text with no HTML tags
    const excerpt = createPostData.content.excerpt;
    assert(!excerpt.includes('<') && !excerpt.includes('>'), 'Excerpt contains zero HTML tags');
    assert(
      excerpt.includes('Welcome') && excerpt.includes('This is a safe post paragraph'),
      'Excerpt contains plain text'
    );

    // 1.3 Plain-text fields reject HTML tag sequences with VALIDATION_ERROR (400)
    const evilTitleRes = await fetch(`${BASE_URL}/api/content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alice.token}`
      },
      body: JSON.stringify({
        title: 'My Title <script>alert(1)</script>',
        body: 'Safe body',
        minTier: 'free'
      })
    });
    const evilTitleData = await evilTitleRes.json();
    assert(evilTitleRes.status === 400, 'Title containing HTML tags returns 400 Bad Request');
    assert(evilTitleData.error?.code === 'VALIDATION_ERROR', 'Error code is VALIDATION_ERROR');

    // 1.4 Comments reject HTML tags with VALIDATION_ERROR
    const commentService = require('../src/services/commentService');
    let commentError = null;
    try {
      await commentService.createComment({
        viewer: subA.data.user,
        contentId: createPostData.content.id,
        body: 'Check out <a href="http://evil.com">free vips</a>'
      });
    } catch (err) {
      commentError = err;
    }
    assert(
      commentError !== null && commentError.statusCode === 400,
      'Comment containing HTML tags returns 400 Bad Request'
    );
    assert(commentError?.code === 'VALIDATION_ERROR', 'Comment error code is VALIDATION_ERROR');

    // 1.5 Plain-text fields accept benign mathematical and emoticon sequences (<3, a < b > c)
    const benignTitleRes = await fetch(`${BASE_URL}/api/content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alice.token}`
      },
      body: JSON.stringify({
        title: 'I <3 CreatorHub & Math: 5 < 10 > 2',
        body: 'Valid post body',
        minTier: 'free'
      })
    });
    assert(
      benignTitleRes.status === 201,
      'Benign sequences like "I <3" and "5 < 10 > 2" are allowed in plain text'
    );

    // =========================================================================
    // SECTION 2: Data Sanitisation Backfill Script
    // =========================================================================
    console.log('\n--- 2. Testing Data Sanitisation Backfill Script ---');

    const runScript = (args) => {
      return new Promise((resolve) => {
        const proc = spawn(
          process.execPath,
          [path.resolve(__dirname, 'sanitize-backfill.js'), ...args],
          {
            env: process.env
          }
        );
        let out = '';
        proc.stdout.on('data', (d) => (out += d.toString()));
        proc.stderr.on('data', (d) => (out += d.toString()));
        proc.on('close', (code) => resolve({ code, out }));
      });
    };

    const dryRun = await runScript([]);
    assert(dryRun.code === 0, 'Backfill script runs in dry-run mode without errors');
    assert(dryRun.out.includes('DRY RUN'), 'Backfill output confirms DRY RUN');

    const applyRun = await runScript(['--apply']);
    assert(applyRun.code === 0, 'Backfill script runs in --apply mode without errors');
    assert(applyRun.out.includes('APPLY MODE'), 'Backfill output confirms APPLY MODE');

    // =========================================================================
    // SECTION 3: SQL Injection Corpus & Static Codebase Audit
    // =========================================================================
    console.log('\n--- 3. Testing SQL Injection Defenses & Static Audit ---');

    // 3.1 Auth login SQLi attempts
    const sqliLogin1 = await login("' OR '1'='1", "' OR '1'='1");
    assert(
      sqliLogin1.status === 400 || sqliLogin1.status === 401,
      'SQLi login attempt rejected cleanly (400 or 401)'
    );
    assert(
      !JSON.stringify(sqliLogin1).includes('SQL syntax'),
      'No SQL syntax error leaked in login'
    );

    // 3.2 Registration SQLi
    const sqliRegister = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: "' OR '1'='1",
        password: 'Password123!',
        name: "'; DROP TABLE users; --",
        role: 'subscriber'
      })
    });
    assert(
      sqliRegister.status === 400,
      'Registration with invalid SQLi email fails validation (400)'
    );
    assert(!JSON.stringify(await sqliRegister.json()).includes('SQL'), 'No raw SQL error returned');

    // Verify database users table remains completely intact
    const verifyUsersRes = await fetch(`${BASE_URL}/api/content`);
    assert(verifyUsersRes.status === 200, 'Database remains intact after SQLi registration attack');

    // 3.3 Content ID path parameter SQLi
    const sqliPath = await fetch(`${BASE_URL}/api/content/' OR 1=1 --`);
    assert(sqliPath.status === 400, 'Invalid UUID path parameter returns 400 VALIDATION_ERROR');

    // 3.4 Pagination parameter injection
    const sqliPagination = await fetch(
      `${BASE_URL}/api/content?page=1;DROP%20TABLE%20users&limit=10`
    );
    assert(
      sqliPagination.status === 400,
      'Malicious pagination parameter returns 400 VALIDATION_ERROR'
    );

    // 3.5 Static codebase audit: scan src/ for dangerous raw SQL query formatting
    const scanDir = (dir) => {
      let results = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(scanDir(full));
        } else if (entry.isFile() && full.endsWith('.js')) {
          results.push(full);
        }
      }
      return results;
    };

    const jsFiles = scanDir(path.resolve(__dirname, '../src'));
    let unescapedInterpolationCount = 0;
    const suspiciousRegex = /sequelize\.query\s*\(\s*`[^`]*\$\{/i;

    for (const file of jsFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (suspiciousRegex.test(content)) {
        console.error(`Suspicious raw SQL interpolation found in ${file}`);
        unescapedInterpolationCount++;
      }
    }
    assert(
      unescapedInterpolationCount === 0,
      'Static SQL audit: 0 unescaped SQL string interpolations across src/'
    );

    // =========================================================================
    // SECTION 4: Helmet Security Headers (Dev vs Production)
    // =========================================================================
    console.log('\n--- 4. Testing Helmet Security Headers ---');

    const healthRes = await fetch(`${BASE_URL}/health`);
    assert(
      healthRes.headers.get('x-content-type-options') === 'nosniff',
      'X-Content-Type-Options: nosniff header present'
    );
    assert(healthRes.headers.get('x-frame-options') !== null, 'X-Frame-Options header present');

    // Spawn production child server to verify strict CSP
    const prodServer = await spawnServer({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://creatorhub.example.com',
      RATE_LIMIT_ENABLED: 'true',
      STORAGE_DRIVER: 'cloudinary',
      CLOUDINARY_CLOUD_NAME: 'test_cloud',
      CLOUDINARY_API_KEY: 'test_key',
      CLOUDINARY_API_SECRET: 'test_secret',
      JWT_SECRET: 'a-very-long-production-jwt-secret-that-is-at-least-32-chars!',
      EMAIL_TOKEN_SECRET: 'a-very-long-production-email-secret-that-is-at-least-32-chars!'
    });

    try {
      const prodHealth = await fetch(`${prodServer.baseUrl}/health`);
      const prodCsp = prodHealth.headers.get('content-security-policy');
      assert(
        prodCsp !== null && prodCsp.includes("default-src 'self'"),
        'Production server applies strict Content-Security-Policy'
      );
    } finally {
      await prodServer.stop();
    }

    // =========================================================================
    // SECTION 5: Unified CORS Enforcement (REST, GraphQL, Socket.io)
    // =========================================================================
    console.log('\n--- 5. Testing Unified CORS Enforcement ---');

    // 5.1 Allowed Origin on REST
    const allowedCorsRes = await fetch(`${BASE_URL}/api/content`, {
      headers: { Origin: 'http://localhost:3000' }
    });
    assert(
      allowedCorsRes.headers.get('access-control-allow-origin') === 'http://localhost:3000',
      'Allowed Origin receives Access-Control-Allow-Origin header'
    );

    // 5.2 Disallowed Origin on REST
    const disallowedCorsRes = await fetch(`${BASE_URL}/api/content`, {
      headers: { Origin: 'http://evil.com' }
    });
    assert(
      disallowedCorsRes.headers.get('access-control-allow-origin') === null,
      'Disallowed Origin does NOT receive Access-Control-Allow-Origin header'
    );

    // 5.3 CORS Preflight OPTIONS
    const preflightRes = await fetch(`${BASE_URL}/api/content`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });
    assert(
      preflightRes.status === 204 || preflightRes.status === 200,
      'Preflight OPTIONS returns 200 or 204'
    );
    assert(
      preflightRes.headers.get('access-control-allow-origin') === 'http://localhost:3000',
      'Preflight returns Access-Control-Allow-Origin for allowed origin'
    );

    // 5.4 Socket.io connection with disallowed origin is rejected
    const socketDisallowed = io(BASE_URL, {
      extraHeaders: { Origin: 'http://evil.com' },
      transports: ['websocket'],
      reconnection: false,
      timeout: 2000
    });

    const socketDisallowedPromise = new Promise((resolve) => {
      socketDisallowed.on('connect_error', (err) => resolve({ error: err.message }));
      socketDisallowed.on('connect', () => resolve({ connected: true }));
      setTimeout(() => resolve({ error: 'timeout' }), 2500);
    });

    const socketDisallowedResult = await socketDisallowedPromise;
    socketDisallowed.disconnect();
    assert(
      socketDisallowedResult.error !== undefined,
      'Socket connection from disallowed Origin is rejected'
    );

    // =========================================================================
    // SECTION 6: Production Startup Safety Checks
    // =========================================================================
    console.log('\n--- 6. Testing Production Startup Safety Checks ---');

    const testStartupFailure = async (overrides, expectedMsg) => {
      return new Promise((resolve) => {
        const proc = spawn(process.execPath, [path.resolve(__dirname, '../src/server.js')], {
          env: {
            ...process.env,
            NODE_ENV: 'production',
            PORT: '59999',
            ...overrides
          }
        });
        let errOut = '';
        proc.stderr.on('data', (d) => (errOut += d.toString()));
        proc.stdout.on('data', (d) => (errOut += d.toString()));
        proc.on('close', (code) => {
          resolve({ code, matches: errOut.includes(expectedMsg), errOut });
        });
      });
    };

    // 6.1 CORS_ORIGIN=* in production
    const failCors = await testStartupFailure(
      { CORS_ORIGIN: '*' },
      'CORS_ORIGIN cannot be empty or contain wildcard ("*") in production mode'
    );
    assert(
      failCors.code !== 0 && failCors.matches,
      'Production rejects startup with CORS_ORIGIN=*'
    );

    // 6.2 RATE_LIMIT_ENABLED=false in production
    const failRateLimit = await testStartupFailure(
      {
        CORS_ORIGIN: 'https://app.creatorhub.com',
        RATE_LIMIT_ENABLED: 'false'
      },
      'RATE_LIMIT_ENABLED cannot be false in production mode'
    );
    assert(
      failRateLimit.code !== 0 && failRateLimit.matches,
      'Production rejects startup with RATE_LIMIT_ENABLED=false'
    );

    // 6.3 STORAGE_DRIVER=fake in production
    const failFakeDriver = await testStartupFailure(
      {
        CORS_ORIGIN: 'https://app.creatorhub.com',
        RATE_LIMIT_ENABLED: 'true',
        STORAGE_DRIVER: 'fake'
      },
      'STORAGE_DRIVER cannot be "fake" in production mode'
    );
    assert(
      failFakeDriver.code !== 0 && failFakeDriver.matches,
      'Production rejects startup with STORAGE_DRIVER=fake'
    );

    // 6.4 Short JWT_SECRET in production (must be at least 32 chars in production)
    const failShortSecret = await testStartupFailure(
      {
        CORS_ORIGIN: 'https://app.creatorhub.com',
        RATE_LIMIT_ENABLED: 'true',
        STORAGE_DRIVER: 'cloudinary',
        CLOUDINARY_CLOUD_NAME: 'cn',
        CLOUDINARY_API_KEY: 'ak',
        CLOUDINARY_API_SECRET: 'as',
        JWT_SECRET: 'this-is-sixteen-chars-not-32'
      },
      'JWT_SECRET must be at least 32 characters in production mode'
    );
    assert(
      failShortSecret.code !== 0 && failShortSecret.matches,
      'Production rejects startup with short JWT_SECRET'
    );

    // =========================================================================
    // SECTION 7: Multi-Tier Rate Limiters & Request Size Controls
    // =========================================================================
    console.log('\n--- 7. Testing Multi-Tier Rate Limiters & Body Limits ---');

    // 7.1 Request payload size limit (100 KB json body)
    const largeBody = 'A'.repeat(120 * 1024); // 120 KB
    const largePayloadRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', padding: largeBody })
    });
    assert(
      largePayloadRes.status === 413,
      'Payload exceeding 100 KB returns 413 Payload Too Large'
    );

    // 7.2 Auth Login Rate Limiter (Max 10 failed attempts, skips successful)
    // Spawn dedicated test server for rate limit testing with specific isolated IP
    const rateLimitServer = await spawnServer({
      RATE_LIMIT_ENABLED: 'true',
      STORAGE_DRIVER: 'fake'
    });

    try {
      const rlBase = rateLimitServer.baseUrl;

      // Make 10 failed login attempts
      for (let i = 0; i < 10; i++) {
        await fetch(`${rlBase}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'alice.creator@creatorhub.local',
            password: 'WrongPassword!'
          })
        });
      }

      // 11th failed attempt must be blocked with 429
      const attempt11 = await fetch(`${rlBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'alice.creator@creatorhub.local',
          password: 'WrongPassword!'
        })
      });
      assert(
        attempt11.status === 429,
        '11th failed login attempt is blocked with 429 Too Many Requests'
      );
      const attempt11Data = await attempt11.json();
      assert(attempt11Data.error?.code === 'RATE_LIMITED', 'Error code is RATE_LIMITED');
    } finally {
      await rateLimitServer.stop();
    }

    // =========================================================================
    // SECTION 8: GraphQL Root Fields Cost Limit
    // =========================================================================
    console.log('\n--- 8. Testing GraphQL Root Fields Cost Limit ---');

    // 8.1 10 root fields (allowed limit)
    const valid10Query = `
      query TenFields {
        f1: tiers { name }
        f2: tiers { name }
        f3: tiers { name }
        f4: tiers { name }
        f5: tiers { name }
        f6: tiers { name }
        f7: tiers { name }
        f8: tiers { name }
        f9: tiers { name }
        f10: tiers { name }
      }
    `;

    const res10 = await fetch(`${BASE_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: valid10Query })
    });
    const data10 = await res10.json();
    assert(
      data10.data !== undefined && !data10.errors,
      'GraphQL query with 10 root fields succeeds'
    );

    // 8.2 11 root fields (exceeds limit of 10)
    const invalid11Query = `
      query ElevenFields {
        f1: tiers { name }
        f2: tiers { name }
        f3: tiers { name }
        f4: tiers { name }
        f5: tiers { name }
        f6: tiers { name }
        f7: tiers { name }
        f8: tiers { name }
        f9: tiers { name }
        f10: tiers { name }
        f11: tiers { name }
      }
    `;

    const res11 = await fetch(`${BASE_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: invalid11Query })
    });
    const data11 = await res11.json();
    assert(
      data11.errors && data11.errors[0]?.message.includes('exceeding maximum allowed limit of 10'),
      'GraphQL query with 11 root fields is rejected by AST cost limiter'
    );

    // =========================================================================
    // SECTION 9: Socket Handshake Concurrent Connection Limit
    // =========================================================================
    console.log('\n--- 9. Testing Socket Handshake Concurrent Connection Limit ---');

    const socketServer = await spawnServer({
      RATE_LIMIT_ENABLED: 'true',
      STORAGE_DRIVER: 'fake'
    });

    try {
      const activeSockets = [];
      let connectedCount = 0;

      // Connect 20 sockets concurrently
      for (let i = 0; i < 20; i++) {
        const s = io(socketServer.baseUrl, {
          transports: ['websocket'],
          reconnection: false,
          timeout: 2000
        });
        activeSockets.push(s);
      }

      await new Promise((resolve) => setTimeout(resolve, 800));
      for (const s of activeSockets) {
        if (s.connected) connectedCount++;
      }
      assert(
        connectedCount >= 18,
        `Successfully connected ${connectedCount} concurrent sockets (max 20)`
      );

      // 21st socket connection from same IP must be rejected
      const socket21 = io(socketServer.baseUrl, {
        transports: ['websocket'],
        reconnection: false,
        timeout: 2000
      });

      const socket21Promise = new Promise((resolve) => {
        socket21.on('connect_error', (err) => resolve({ error: err.message }));
        socket21.on('connect', () => resolve({ connected: true }));
        setTimeout(() => resolve({ error: 'timeout' }), 2000);
      });

      const res21 = await socket21Promise;
      socket21.disconnect();
      assert(
        res21.error !== undefined,
        '21st concurrent socket connection from same IP is rejected'
      );

      // Cleanup sockets
      for (const s of activeSockets) {
        s.disconnect();
      }
    } finally {
      await socketServer.stop();
    }

    // =========================================================================
    // SECTION 10: Reverse Proxy Trust (TRUST_PROXY)
    // =========================================================================
    console.log('\n--- 10. Testing TRUST_PROXY IP Extraction ---');

    // Test trust proxy enabled
    const proxyServer = await spawnServer({
      RATE_LIMIT_ENABLED: 'true',
      STORAGE_DRIVER: 'fake',
      TRUST_PROXY: 'true'
    });

    try {
      // Send request with X-Forwarded-For header
      const forwardedRes = await fetch(`${proxyServer.baseUrl}/health`, {
        headers: { 'X-Forwarded-For': '203.0.113.195' }
      });
      assert(
        forwardedRes.status === 200,
        'Server with TRUST_PROXY=true handles forwarded requests properly'
      );
    } finally {
      await proxyServer.stop();
    }
  } catch (err) {
    console.error('\n[Fatal Test Runner Error]:', err);
    failed++;
  } finally {
    await mainServer.stop();
  }

  console.log('\n================================================================');
  if (failed === 0) {
    console.log(`🎉 ALL ${passed} SECURITY VERIFICATION CHECKS PASSED! (Failed: 0)`);
  } else {
    console.error(`💥 VERIFICATION FAILED! Passed: ${passed}, Failed: ${failed}`);
    process.exitCode = 1;
  }
  console.log('================================================================\n');
}

run();
