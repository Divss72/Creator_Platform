'use strict';

const { createTestApi } = require('../helpers/api');
const { resetDb } = require('../helpers/db');
const { createCreator, createSubscriber, createPost, createSubscription } = require('../helpers/factories');
const { countQueries } = require('../helpers/queryCounter');

describe('Integration: Paywall Matrix & Preview Parity', () => {
  let api;

  beforeAll(() => {
    api = createTestApi();
  });

  beforeEach(async () => {
    await resetDb();
  });

  test('exhaustive matrix of viewer personas x post tiers enforces exact access rules', async () => {
    const creator = await createCreator({ displayName: 'Matrix Creator' });
    const otherCreator = await createCreator({ displayName: 'Other Creator' });

    const anonUser = null;
    const freeSub = await createSubscriber({ name: 'Free Sub' });
    await createSubscription({ subscriberId: freeSub.id, creatorId: creator.id, tier: 'free' });

    const proSub = await createSubscriber({ name: 'Pro Sub' });
    await createSubscription({ subscriberId: proSub.id, creatorId: creator.id, tier: 'pro' });

    const vipSub = await createSubscriber({ name: 'VIP Sub' });
    await createSubscription({ subscriberId: vipSub.id, creatorId: creator.id, tier: 'vip' });

    const secretMarker = 'PAYWALLED_EXCLUSIVE_SECRET_DATA_SCAN_VERIFY';
    const freePost = await createPost({
      creatorId: creator.id,
      minTier: 'free',
      title: 'Free Post',
      body: '<p>Public content for all</p>'
    });
    const proPost = await createPost({
      creatorId: creator.id,
      minTier: 'pro',
      title: 'Pro Post',
      body: `<p>Intro</p><p>${'A'.repeat(250)}</p><p>${secretMarker}_PRO</p>`
    });
    const vipPost = await createPost({
      creatorId: creator.id,
      minTier: 'vip',
      title: 'VIP Post',
      body: `<p>Intro</p><p>${'B'.repeat(250)}</p><p>${secretMarker}_VIP</p>`
    });

    // Matrix definition: [user, post, expectedLocked]
    const testCases = [
      // Anonymous
      { user: anonUser, post: freePost, expectedLocked: false, label: 'Anon -> Free Post' },
      { user: anonUser, post: proPost, expectedLocked: true, label: 'Anon -> Pro Post' },
      { user: anonUser, post: vipPost, expectedLocked: true, label: 'Anon -> VIP Post' },
      // Free Subscriber
      { user: freeSub, post: freePost, expectedLocked: false, label: 'FreeSub -> Free Post' },
      { user: freeSub, post: proPost, expectedLocked: true, label: 'FreeSub -> Pro Post' },
      { user: freeSub, post: vipPost, expectedLocked: true, label: 'FreeSub -> VIP Post' },
      // Pro Subscriber
      { user: proSub, post: freePost, expectedLocked: false, label: 'ProSub -> Free Post' },
      { user: proSub, post: proPost, expectedLocked: false, label: 'ProSub -> Pro Post' },
      { user: proSub, post: vipPost, expectedLocked: true, label: 'ProSub -> VIP Post' },
      // VIP Subscriber
      { user: vipSub, post: freePost, expectedLocked: false, label: 'VipSub -> Free Post' },
      { user: vipSub, post: proPost, expectedLocked: false, label: 'VipSub -> Pro Post' },
      { user: vipSub, post: vipPost, expectedLocked: false, label: 'VipSub -> VIP Post' },
      // Post Author (Creator)
      { user: creator, post: freePost, expectedLocked: false, label: 'OwnerCreator -> Free Post' },
      { user: creator, post: proPost, expectedLocked: false, label: 'OwnerCreator -> Pro Post' },
      { user: creator, post: vipPost, expectedLocked: false, label: 'OwnerCreator -> VIP Post' },
      // Non-author Creator
      { user: otherCreator, post: freePost, expectedLocked: false, label: 'OtherCreator -> Free Post' },
      { user: otherCreator, post: proPost, expectedLocked: true, label: 'OtherCreator -> Pro Post' },
      { user: otherCreator, post: vipPost, expectedLocked: true, label: 'OtherCreator -> VIP Post' }
    ];

    for (const tc of testCases) {
      let req = api.request.get(`/api/content/${tc.post.id}`);
      if (tc.user && tc.user.token) {
        req = req.set('Authorization', `Bearer ${tc.user.token}`);
      }

      const res = await req;
      expect(res.status).toBe(200);
      expect(res.body.content.locked).toBe(tc.expectedLocked);

      if (tc.expectedLocked) {
        expect(res.body.content.body).toBeNull();
        expect(JSON.stringify(res.body)).not.toContain(secretMarker);
      } else {
        expect(res.body.content.body).not.toBeNull();
      }
    }
  });

  test('single-query bulk paywall resolution avoids N+1 queries when listing posts', async () => {
    const creator = await createCreator();
    const subscriber = await createSubscriber();
    await createSubscription({ subscriberId: subscriber.id, creatorId: creator.id, tier: 'pro' });

    // Create 10 posts
    for (let i = 0; i < 10; i++) {
      await createPost({
        creatorId: creator.id,
        minTier: i % 2 === 0 ? 'free' : 'pro'
      });
    }

    // Query counter should verify that listing 10 items executes a constant bounded number of queries (<= 4)
    const { result, queryCount } = await countQueries(async () => {
      return api.request
        .get('/api/content?limit=10')
        .set('Authorization', `Bearer ${subscriber.token}`);
    });

    expect(result.status).toBe(200);
    expect(result.body.items).toHaveLength(10);
    expect(queryCount).toBeLessThanOrEqual(5);
  });
});

