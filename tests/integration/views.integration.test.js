'use strict';

const { createTestApi } = require('../helpers/api');
const { resetDb } = require('../helpers/db');
const {
  createCreator,
  createSubscriber,
  createPost,
  createSubscription
} = require('../helpers/factories');
const { sequelize } = require('../../src/models');
const { toUtcDateString } = require('../../src/services/math/series');

describe('Integration: Views Recording & Deduplication', () => {
  let api;
  const browserUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  beforeAll(() => {
    api = createTestApi();
  });

  beforeEach(async () => {
    await resetDb();
  });

  test('POST /api/content/:id/view records view and returns 204 No Content', async () => {
    const creator = await createCreator();
    const post = await createPost({ creatorId: creator.id, minTier: 'free' });
    const viewer = await createSubscriber();

    const res = await api.request
      .post(`/api/content/${post.id}/view`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .set('User-Agent', browserUa)
      .send();

    expect(res.status).toBe(204);

    // Verify row in content_daily_stats
    const today = toUtcDateString(new Date());
    const stats = await sequelize.query(
      `SELECT * FROM content_daily_stats WHERE content_id = :contentId AND day = :today`,
      { replacements: { contentId: post.id, today }, type: sequelize.QueryTypes.SELECT }
    );

    expect(stats).toHaveLength(1);
    expect(Number(stats[0].views)).toBe(1);
    expect(Number(stats[0].locked_views)).toBe(0);
  });

  test('deduplicates multiple views from same viewer on the same calendar day', async () => {
    const creator = await createCreator();
    const post = await createPost({ creatorId: creator.id, minTier: 'free' });
    const viewer = await createSubscriber();

    // First view
    const res1 = await api.request
      .post(`/api/content/${post.id}/view`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .set('User-Agent', browserUa)
      .send();
    expect(res1.status).toBe(204);

    // Second view from same viewer
    const res2 = await api.request
      .post(`/api/content/${post.id}/view`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .set('User-Agent', browserUa)
      .send();
    expect(res2.status).toBe(204);

    const today = toUtcDateString(new Date());
    const stats = await sequelize.query(
      `SELECT * FROM content_daily_stats WHERE content_id = :contentId AND day = :today`,
      { replacements: { contentId: post.id, today }, type: sequelize.QueryTypes.SELECT }
    );

    expect(Number(stats[0].views)).toBe(1); // Not 2!
  });

  test('server enforces locked_views vs unlocked views according to paywall status', async () => {
    const creator = await createCreator();
    const proPost = await createPost({ creatorId: creator.id, minTier: 'pro' });

    const freeViewer = await createSubscriber();
    const proViewer = await createSubscriber();
    await createSubscription({ subscriberId: proViewer.id, creatorId: creator.id, tier: 'pro' });

    // 1. Free viewer views pro post -> locked view
    await api.request
      .post(`/api/content/${proPost.id}/view`)
      .set('Authorization', `Bearer ${freeViewer.token}`)
      .set('User-Agent', browserUa)
      .send();

    // 2. Pro viewer views pro post -> unlocked view
    await api.request
      .post(`/api/content/${proPost.id}/view`)
      .set('Authorization', `Bearer ${proViewer.token}`)
      .set('User-Agent', browserUa)
      .send();

    const today = toUtcDateString(new Date());
    const stats = await sequelize.query(
      `SELECT * FROM content_daily_stats WHERE content_id = :contentId AND day = :today`,
      { replacements: { contentId: proPost.id, today }, type: sequelize.QueryTypes.SELECT }
    );

    expect(Number(stats[0].views)).toBe(2); // Total views (1 unlocked + 1 locked)
    expect(Number(stats[0].locked_views)).toBe(1);
  });

  test('ignores creator self-views and bot user-agents', async () => {
    const creator = await createCreator();
    const post = await createPost({ creatorId: creator.id, minTier: 'free' });

    // Creator self-view
    const resSelf = await api.request
      .post(`/api/content/${post.id}/view`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send();
    expect(resSelf.status).toBe(204);

    // Bot view
    const resBot = await api.request
      .post(`/api/content/${post.id}/view`)
      .set('User-Agent', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
      .send();
    expect(resBot.status).toBe(204);

    const stats = await sequelize.query(
      `SELECT * FROM content_daily_stats WHERE content_id = :contentId`,
      { replacements: { contentId: post.id }, type: sequelize.QueryTypes.SELECT }
    );

    expect(stats).toHaveLength(0);
  });
});
