'use strict';

const { createTestApi } = require('../helpers/api');
const { resetDb } = require('../helpers/db');
const {
  createCreator,
  createSubscriber,
  createPost,
  createSubscription
} = require('../helpers/factories');
const { toUtcDateString } = require('../../src/services/math/series');
const rollupService = require('../../src/services/rollupService');

describe('Integration: Creator Analytics Endpoints', () => {
  let api;

  beforeAll(() => {
    api = createTestApi();
  });

  beforeEach(async () => {
    await resetDb();
  });

  test('only authenticated creators can access analytics endpoints', async () => {
    const creator = await createCreator();
    const subscriber = await createSubscriber();

    // 1. Anonymous -> 401
    const unauth = await api.request.get('/api/creators/me/analytics/overview');
    expect(unauth.status).toBe(401);

    // 2. Subscriber -> 403
    const subRes = await api.request
      .get('/api/creators/me/analytics/overview')
      .set('Authorization', `Bearer ${subscriber.token}`);
    expect(subRes.status).toBe(403);

    // 3. Creator -> 200 with Cache-Control: private, no-store
    const creatorRes = await api.request
      .get('/api/creators/me/analytics/overview')
      .set('Authorization', `Bearer ${creator.token}`);
    expect(creatorRes.status).toBe(200);
    expect(creatorRes.headers['cache-control']).toBe('private, no-store');
  });

  test('validates range parameter across analytics routes', async () => {
    const creator = await createCreator();

    const invalidRes = await api.request
      .get('/api/creators/me/analytics/overview?range=invalid')
      .set('Authorization', `Bearer ${creator.token}`);
    expect(invalidRes.status).toBe(400);

    const valid7d = await api.request
      .get('/api/creators/me/analytics/overview?range=7d')
      .set('Authorization', `Bearer ${creator.token}`);
    expect(valid7d.status).toBe(200);
    expect(valid7d.body.range).toBe('7d');
    expect(valid7d.body.daysCount).toBe(7);
  });

  test('combines past rollups with live today data in overview', async () => {
    const creator = await createCreator();
    const sub1 = await createSubscriber();
    const sub2 = await createSubscriber();

    // Subscribe sub1 (Pro: 1500 cents) and sub2 (VIP: 5000 cents)
    await createSubscription({ subscriberId: sub1.id, creatorId: creator.id, tier: 'pro' });
    await createSubscription({ subscriberId: sub2.id, creatorId: creator.id, tier: 'vip' });

    // Run rollup up to yesterday
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const tenDaysAgo = new Date(now.getTime() - 10 * 86400000);
    await rollupService.processRollups({
      fromDate: toUtcDateString(tenDaysAgo),
      toDate: toUtcDateString(yesterday),
      creatorId: creator.id
    });

    const res = await api.request
      .get('/api/creators/me/analytics/overview?range=7d')
      .set('Authorization', `Bearer ${creator.token}`);

    expect(res.status).toBe(200);
    expect(res.body.subscribers.total).toBe(2);
    expect(res.body.subscribers.byTier.pro).toBe(1);
    expect(res.body.subscribers.byTier.vip).toBe(1);
    expect(res.body.mrr.currentCents).toBe(2000); // 500 (Pro) + 1500 (VIP)
  });

  test('GET /timeseries returns continuous dates with no missing days', async () => {
    const creator = await createCreator();

    const res = await api.request
      .get('/api/creators/me/analytics/timeseries?range=7d')
      .set('Authorization', `Bearer ${creator.token}`);

    expect(res.status).toBe(200);
    expect(res.body.series).toHaveLength(7);

    // Verify chronological order
    for (let i = 0; i < res.body.series.length - 1; i++) {
      expect(res.body.series[i].day < res.body.series[i + 1].day).toBe(true);
    }
  });

  test('GET /top-content sorts creator content by views, likes, or comments', async () => {
    const creator = await createCreator();
    const post1 = await createPost({ creatorId: creator.id, title: 'Post One' });
    const post2 = await createPost({ creatorId: creator.id, title: 'Post Two' });

    const sub = await createSubscriber();

    // Like post2
    await api.request
      .put(`/api/content/${post2.id}/like`)
      .set('Authorization', `Bearer ${sub.token}`)
      .send();

    const resLikes = await api.request
      .get('/api/creators/me/analytics/top-content?sortBy=likes&limit=5')
      .set('Authorization', `Bearer ${creator.token}`);

    expect(resLikes.status).toBe(200);
    expect(resLikes.body.items).toHaveLength(2);
    expect(resLikes.body.items[0].id).toBe(post2.id);
    expect(resLikes.body.items[0].likes).toBe(1);
    expect(resLikes.body.items[1].likes).toBe(0);
  });
});
