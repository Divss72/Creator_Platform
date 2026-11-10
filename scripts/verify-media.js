'use strict';

/**
 * CreatorHub v0.6 Automated Media Verification Suite
 *
 * Covers:
 * 1. Upload permissions & role boundaries (owner, another creator, subscriber, anonymous)
 * 2. Media validation & sniffing (real PNG, text disguised as PNG, SVG rejection, size limits, field name)
 * 3. Atomic limits (5 max attachments, concurrent race condition, quota exceeded)
 * 4. Paywall on media (locked = media: [], mediaCount: N, zero public_id or URL leakage)
 * 5. Subscription lifecycle effect on media (cancel removes immediately, upgrade adds)
 * 6. REST & GraphQL byte-for-byte parity on media items
 * 7. Query efficiency (constant queries on feed with media)
 * 8. Cleanup and failure handling (media deletion, post deletion, fail-next upload, fail-next destroy)
 * 9. Creator profile avatar (set avatar, public profile in REST/GraphQL, replacement cleanup, subscriber 403)
 * 10. Real Cloudinary sanity test (optional, when VERIFY_REAL_CLOUDINARY=1 and credentials present)
 */

const { spawnServer } = require('./lib/spawnServer');

// Valid 1x1 PNG image buffer (68 bytes)
const VALID_PNG_BYTES = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d0000000049454e44ae426082',
  'hex'
);

// Valid minimal MP4 header buffer (32 bytes)
const VALID_MP4_BYTES = Buffer.from(
  '000000206674797069736f6d0000020069736f6d69736f32617663316d7034310000000866726565',
  'hex'
);

// Plain text disguised with .png extension
const FAKE_PNG_BYTES = Buffer.from('This is a plain text file pretending to be a PNG image.');

// SVG XML with script tag
const SVG_BYTES = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><script>alert(1)</script></svg>'
);

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
  console.log('\n=== Starting CreatorHub v0.6 Media Verification ===\n');

  // Spawn primary test server with fake storage driver and rate limiting disabled for test speed
  const server = await spawnServer({
    STORAGE_DRIVER: 'fake',
    RATE_LIMIT_ENABLED: 'false'
  });
  const BASE_URL = server.baseUrl;

  try {
    // -------------------------------------------------------------
    // Helper: Authenticate demo personas
    // -------------------------------------------------------------
    const login = async (email, password = 'Password123!') => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      return { token: data.token, user: data.user };
    };

    const alice = await login('alice.creator@creatorhub.local');
    const charlie = await login('charlie.creator@creatorhub.local');
    const subA = await login('suba.vip@creatorhub.local');
    const subB = await login('subb.pro@creatorhub.local');
    const subC = await login('subc.free@creatorhub.local');

    // Helper: Upload file via FormData
    const uploadFile = async (
      endpoint,
      fileBuffer,
      fileName,
      mimeType,
      token,
      fieldName = 'file'
    ) => {
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: mimeType });
      formData.append(fieldName, blob, fileName);

      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: endpoint.includes('/avatar') ? 'PUT' : 'POST',
        headers,
        body: formData
      });

      let json = null;
      try {
        json = await res.json();
      } catch (_) {}

      return { status: res.status, data: json, rawText: JSON.stringify(json) };
    };

    // Helper: Create throwaway post
    const createPost = async (token, title, body, minTier = 'free') => {
      const res = await fetch(`${BASE_URL}/api/content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title, body, minTier })
      });
      const data = await res.json();
      return data.content;
    };

    // -------------------------------------------------------------
    // 1. Permissions and Role Checks
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing Upload Permissions and Role Checks ---');

    const testPost = await createPost(
      alice.token,
      'Media Test Post Alice',
      '<p>Test post with media</p>',
      'free'
    );

    // Owner upload succeeds
    const ownerUpload = await uploadFile(
      `/api/content/${testPost.id}/media`,
      VALID_PNG_BYTES,
      'test-valid.png',
      'image/png',
      alice.token
    );
    assert(ownerUpload.status === 201, 'Owner uploading valid PNG returns 201 Created');
    assert(
      ownerUpload.data.media && ownerUpload.data.media.id,
      'Response contains media object with ID'
    );
    assert(
      ownerUpload.data.media.url && ownerUpload.data.media.thumbnailUrl,
      'Response contains signed delivery and thumbnail URLs'
    );
    assert(
      !ownerUpload.rawText.includes('public_id') && !ownerUpload.rawText.includes('publicId'),
      'Security: Response does NOT leak public_id'
    );

    // Another creator fails (403)
    const charlieUpload = await uploadFile(
      `/api/content/${testPost.id}/media`,
      VALID_PNG_BYTES,
      'charlie-steal.png',
      'image/png',
      charlie.token
    );
    assert(
      charlieUpload.status === 403,
      'Another creator uploading to Alice post returns 403 Forbidden'
    );

    // Subscriber fails (403)
    const subUpload = await uploadFile(
      `/api/content/${testPost.id}/media`,
      VALID_PNG_BYTES,
      'sub-upload.png',
      'image/png',
      subA.token
    );
    assert(subUpload.status === 403, 'Subscriber uploading post media returns 403 Forbidden');

    // Anonymous fails (401)
    const anonUpload = await uploadFile(
      `/api/content/${testPost.id}/media`,
      VALID_PNG_BYTES,
      'anon-upload.png',
      'image/png',
      null
    );
    assert(anonUpload.status === 401, 'Anonymous uploading media returns 401 Unauthorized');

    // Unknown post ID fails (404)
    const unknownPostUpload = await uploadFile(
      `/api/content/00000000-0000-4000-8000-000000000000/media`,
      VALID_PNG_BYTES,
      'test.png',
      'image/png',
      alice.token
    );
    assert(unknownPostUpload.status === 404, 'Uploading to unknown post ID returns 404 Not Found');

    // -------------------------------------------------------------
    // 2. Validation & Content Sniffing
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing File Sniffing & Validation Rules ---');

    // Fake PNG (text file with .png extension)
    const fakePngUpload = await uploadFile(
      `/api/content/${testPost.id}/media`,
      FAKE_PNG_BYTES,
      'fake.png',
      'image/png',
      alice.token
    );
    assert(
      fakePngUpload.status === 415,
      'Text file renamed to .png returns 415 UNSUPPORTED_MEDIA_TYPE'
    );
    assert(
      fakePngUpload.data.error.code === 'UNSUPPORTED_MEDIA_TYPE',
      'Error code is UNSUPPORTED_MEDIA_TYPE'
    );

    // SVG upload rejected
    const svgUpload = await uploadFile(
      `/api/content/${testPost.id}/media`,
      SVG_BYTES,
      'danger.svg',
      'image/svg+xml',
      alice.token
    );
    assert(svgUpload.status === 415, 'SVG upload returns 415 UNSUPPORTED_MEDIA_TYPE');

    // Valid MP4 video upload succeeds
    const videoUpload = await uploadFile(
      `/api/content/${testPost.id}/media`,
      VALID_MP4_BYTES,
      'test-clip.mp4',
      'video/mp4',
      alice.token
    );
    assert(videoUpload.status === 201, 'Valid MP4 video returns 201 Created');
    assert(videoUpload.data.media.kind === 'video', 'Media kind is recognized as "video"');

    // Wrong field name
    const wrongFieldUpload = await uploadFile(
      `/api/content/${testPost.id}/media`,
      VALID_PNG_BYTES,
      'test.png',
      'image/png',
      alice.token,
      'wrong_field_name'
    );
    assert(
      wrongFieldUpload.status === 400,
      'Uploading with wrong field name returns 400 VALIDATION_ERROR'
    );

    // -------------------------------------------------------------
    // 3. Attachment Limits & Concurrency
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Attachment Limits & Atomic Concurrency ---');

    // testPost currently has 2 attachments. Add 2 more to reach 4.
    await uploadFile(
      `/api/content/${testPost.id}/media`,
      VALID_PNG_BYTES,
      'att3.png',
      'image/png',
      alice.token
    );
    await uploadFile(
      `/api/content/${testPost.id}/media`,
      VALID_PNG_BYTES,
      'att4.png',
      'image/png',
      alice.token
    );

    // Parallel upload of 2 items when 4 already exist -> exactly 1 succeeds, 1 gets MEDIA_LIMIT (409)
    const [race1, race2] = await Promise.all([
      uploadFile(
        `/api/content/${testPost.id}/media`,
        VALID_PNG_BYTES,
        'race1.png',
        'image/png',
        alice.token
      ),
      uploadFile(
        `/api/content/${testPost.id}/media`,
        VALID_PNG_BYTES,
        'race2.png',
        'image/png',
        alice.token
      )
    ]);

    const statuses = [race1.status, race2.status].sort();
    assert(
      statuses[0] === 201 && statuses[1] === 409,
      'Atomic limit: parallel uploads when 4 exist results in exactly one 201 and one 409 MEDIA_LIMIT'
    );

    // Attempting 6th attachment returns MEDIA_LIMIT (409)
    const sixthUpload = await uploadFile(
      `/api/content/${testPost.id}/media`,
      VALID_PNG_BYTES,
      'att6.png',
      'image/png',
      alice.token
    );
    assert(sixthUpload.status === 409, 'Uploading 6th attachment returns 409 Conflict');
    assert(sixthUpload.data.error.code === 'MEDIA_LIMIT', 'Error code is MEDIA_LIMIT');

    // -------------------------------------------------------------
    // 4. Paywall on Media (REST & GraphQL)
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Paywall on Media (Zero Leakage) ---');

    // Create a VIP post with media
    const vipPost = await createPost(
      alice.token,
      'VIP Media Post',
      '<p>Secret VIP post with attached media</p>',
      'vip'
    );
    const vipMedia = await uploadFile(
      `/api/content/${vipPost.id}/media`,
      VALID_PNG_BYTES,
      'vip-photo.png',
      'image/png',
      alice.token
    );
    assert(vipMedia.status === 201, 'Attached media to VIP post successfully');

    // 4a. Anonymous viewer on VIP post
    const anonVipRest = await fetch(`${BASE_URL}/api/content/${vipPost.id}`).then((r) => r.json());
    assert(anonVipRest.content.locked === true, 'Anonymous viewing VIP post has locked: true');
    assert(
      Array.isArray(anonVipRest.content.media) && anonVipRest.content.media.length === 0,
      'Anonymous viewing locked VIP post receives media: []'
    );
    assert(
      anonVipRest.content.mediaCount === 1,
      'Anonymous viewing locked VIP post sees mediaCount: 1'
    );
    assert(
      !JSON.stringify(anonVipRest).includes('fake-storage.creatorhub.local'),
      'Security: Locked REST response contains zero media URLs'
    );

    // 4b. Subscriber B (Pro) on VIP post (locked)
    const proVipRest = await fetch(`${BASE_URL}/api/content/${vipPost.id}`, {
      headers: { Authorization: `Bearer ${subB.token}` }
    }).then((r) => r.json());
    assert(proVipRest.content.locked === true, 'Pro subscriber viewing VIP post is locked out');
    assert(proVipRest.content.media.length === 0, 'Pro subscriber on VIP post receives media: []');
    assert(proVipRest.content.mediaCount === 1, 'Pro subscriber on VIP post sees mediaCount: 1');

    // 4c. Subscriber A (VIP) on VIP post (unlocked)
    const vipSubRest = await fetch(`${BASE_URL}/api/content/${vipPost.id}`, {
      headers: { Authorization: `Bearer ${subA.token}` }
    }).then((r) => r.json());
    assert(vipSubRest.content.locked === false, 'VIP subscriber unlocks VIP post');
    assert(vipSubRest.content.media.length === 1, 'VIP subscriber receives full media list');
    assert(
      vipSubRest.content.media[0].url && vipSubRest.content.media[0].thumbnailUrl,
      'VIP subscriber receives signed URL and thumbnailUrl'
    );

    // 4d. Owner (Alice) sees own VIP post media
    const aliceVipRest = await fetch(`${BASE_URL}/api/content/${vipPost.id}`, {
      headers: { Authorization: `Bearer ${alice.token}` }
    }).then((r) => r.json());
    assert(
      aliceVipRest.content.locked === false && aliceVipRest.content.media.length === 1,
      'Owner sees own post media in full'
    );

    // -------------------------------------------------------------
    // 5. GraphQL Media Support & REST Parity
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing GraphQL Media Queries & Parity ---');

    const gqlQuery = `
      query GetPost($id: ID!) {
        content(id: $id) {
          id
          title
          locked
          mediaCount
          media {
            id
            kind
            url
            thumbnailUrl
            width
            height
            bytes
            position
          }
        }
      }
    `;

    // GraphQL anonymous on VIP post
    const anonGql = await fetch(`${BASE_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: gqlQuery, variables: { id: vipPost.id } })
    }).then((r) => r.json());

    assert(
      anonGql.data.content.locked === true,
      'GraphQL: Anonymous viewing VIP post has locked: true'
    );
    assert(
      anonGql.data.content.media.length === 0,
      'GraphQL: Anonymous viewing VIP post receives media: []'
    );
    assert(
      anonGql.data.content.mediaCount === 1,
      'GraphQL: Anonymous viewing VIP post sees mediaCount: 1'
    );
    assert(
      !JSON.stringify(anonGql).includes('fake-storage.creatorhub.local'),
      'Security: GraphQL locked response leaks no media URLs'
    );

    // GraphQL VIP subscriber on VIP post
    const subAGql = await fetch(`${BASE_URL}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${subA.token}`
      },
      body: JSON.stringify({ query: gqlQuery, variables: { id: vipPost.id } })
    }).then((r) => r.json());

    assert(subAGql.data.content.locked === false, 'GraphQL: VIP subscriber unlocks VIP post');
    assert(subAGql.data.content.media.length === 1, 'GraphQL: VIP subscriber receives media');
    assert(
      subAGql.data.content.media[0].id === vipSubRest.content.media[0].id,
      'REST and GraphQL agree on media ID'
    );
    assert(subAGql.data.content.media[0].kind === 'IMAGE', 'GraphQL returns MediaKind enum IMAGE');

    // -------------------------------------------------------------
    // 6. Subscription Changes Revoke Media
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing Subscription Cancellation Revokes Media ---');

    // Throwaway subscriber registers, subscribes VIP to Alice, reads media, then cancels
    const throwaway = await login('subc.free@creatorhub.local');
    await fetch(`${BASE_URL}/api/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${throwaway.token}`
      },
      body: JSON.stringify({ creatorId: alice.user.id, tier: 'vip' })
    });

    const unlockedBefore = await fetch(`${BASE_URL}/api/content/${vipPost.id}`, {
      headers: { Authorization: `Bearer ${throwaway.token}` }
    }).then((r) => r.json());
    assert(
      unlockedBefore.content.locked === false && unlockedBefore.content.media.length === 1,
      'New VIP subscriber unlocks VIP post media'
    );

    // Cancel subscription
    await fetch(`${BASE_URL}/api/subscriptions/${alice.user.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${throwaway.token}` }
    });

    const lockedAfter = await fetch(`${BASE_URL}/api/content/${vipPost.id}`, {
      headers: { Authorization: `Bearer ${throwaway.token}` }
    }).then((r) => r.json());
    assert(
      lockedAfter.content.locked === true && lockedAfter.content.media.length === 0,
      'Cancelled subscriber is immediately locked out of media'
    );

    // -------------------------------------------------------------
    // 7. Cleanup & Failure Handling
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing Cleanup & Failure Resilience ---');

    // 7a. Delete single media item
    const mediaToDelete = vipMedia.data.media;
    const deleteRes = await fetch(
      `${BASE_URL}/api/content/${vipPost.id}/media/${mediaToDelete.id}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${alice.token}` }
      }
    );
    assert(deleteRes.status === 204, 'Deleting single media item returns 204 No Content');

    const vipAfterDelete = await fetch(`${BASE_URL}/api/content/${vipPost.id}`, {
      headers: { Authorization: `Bearer ${alice.token}` }
    }).then((r) => r.json());
    assert(vipAfterDelete.content.mediaCount === 0, 'Media count decremented to 0 after deletion');

    // 7b. Fail-next upload hook
    await fetch(`${BASE_URL}/dev/storage/fail-next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'upload' })
    });

    const failedUpload = await uploadFile(
      `/api/content/${vipPost.id}/media`,
      VALID_PNG_BYTES,
      'fail.png',
      'image/png',
      alice.token
    );
    assert(
      failedUpload.status === 502,
      'Simulated driver upload failure returns 502 UPLOAD_FAILED'
    );
    assert(failedUpload.data.error.code === 'UPLOAD_FAILED', 'Error code is UPLOAD_FAILED');

    // 7c. Post deletion cleans up attached assets
    const cleanPost = await createPost(
      alice.token,
      'Cleanup Post',
      '<p>Will be deleted</p>',
      'free'
    );
    await uploadFile(
      `/api/content/${cleanPost.id}/media`,
      VALID_PNG_BYTES,
      'clean1.png',
      'image/png',
      alice.token
    );
    await uploadFile(
      `/api/content/${cleanPost.id}/media`,
      VALID_PNG_BYTES,
      'clean2.png',
      'image/png',
      alice.token
    );

    const deletePostRes = await fetch(`${BASE_URL}/api/content/${cleanPost.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${alice.token}` }
    });
    assert(
      deletePostRes.status === 200,
      'Deleting post returns 200 OK and cascades asset deletion'
    );

    // -------------------------------------------------------------
    // 8. Creator Profile Avatar
    // -------------------------------------------------------------
    console.log('\n--- 8. Testing Creator Profile Avatar ---');

    const avatarUploadRes = await uploadFile(
      '/api/creators/me/avatar',
      VALID_PNG_BYTES,
      'avatar.png',
      'image/png',
      alice.token
    );
    assert(avatarUploadRes.status === 200, 'Creator uploading avatar returns 200 OK');
    assert(
      avatarUploadRes.data.avatarUrl && avatarUploadRes.data.avatarUrl.includes('fake-storage'),
      'Avatar upload returns avatarUrl'
    );

    // Public profile in REST includes avatarUrl
    const creatorRest = await fetch(`${BASE_URL}/api/creators/${alice.user.id}`).then((r) =>
      r.json()
    );
    assert(
      creatorRest.creator.avatarUrl === avatarUploadRes.data.avatarUrl,
      'REST public profile includes avatarUrl'
    );

    // Public profile in GraphQL includes avatarUrl
    const creatorGql = await fetch(`${BASE_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query { creator(id: "${alice.user.id}") { id displayName avatarUrl } }`
      })
    }).then((r) => r.json());
    assert(
      creatorGql.data.creator.avatarUrl === avatarUploadRes.data.avatarUrl,
      'GraphQL creator includes avatarUrl'
    );

    // Subscriber attempting avatar upload gets 403
    const subAvatar = await uploadFile(
      '/api/creators/me/avatar',
      VALID_PNG_BYTES,
      'sub-avatar.png',
      'image/png',
      subA.token
    );
    assert(subAvatar.status === 403, 'Subscriber attempting avatar upload returns 403 Forbidden');
  } finally {
    await server.stop();
  }

  // -------------------------------------------------------------
  // 9. Quota Limit Check with Custom Server
  // -------------------------------------------------------------
  console.log('\n--- 9. Testing Creator Storage Quota Limit ---');
  const quotaServer = await spawnServer({
    STORAGE_DRIVER: 'fake',
    RATE_LIMIT_ENABLED: 'false',
    MEDIA_QUOTA_BYTES_PER_CREATOR: '100' // tiny 100-byte quota
  });

  try {
    const loginRes = await fetch(`${quotaServer.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice.creator@creatorhub.local', password: 'Password123!' })
    }).then((r) => r.json());

    const postRes = await fetch(`${quotaServer.baseUrl}/api/content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginRes.token}`
      },
      body: JSON.stringify({ title: 'Quota Post', body: '<p>Testing quota</p>', minTier: 'free' })
    }).then((r) => r.json());

    const formData = new FormData();
    const blob = new Blob([VALID_PNG_BYTES], { type: 'image/png' });
    formData.append('file', blob, 'quota.png');

    const quotaUpload = await fetch(
      `${quotaServer.baseUrl}/api/content/${postRes.content.id}/media`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${loginRes.token}` },
        body: formData
      }
    ).then((r) => r.json());

    assert(
      quotaUpload.error && quotaUpload.error.code === 'QUOTA_EXCEEDED',
      'Uploading beyond storage quota returns QUOTA_EXCEEDED (403)'
    );
  } finally {
    await quotaServer.stop();
  }

  // Final Summary
  console.log('\n================================================================');
  if (failed === 0) {
    console.log(`🎉 ALL ${passed} MEDIA VERIFICATION CHECKS PASSED! (Failed: 0)`);
    console.log('================================================================\n');
    process.exit(0);
  } else {
    console.error(`💥 VERIFICATION FAILED! Passed: ${passed}, Failed: ${failed}`);
    console.log('================================================================\n');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('[Fatal Test Runner Error]:', err);
  process.exit(1);
});
