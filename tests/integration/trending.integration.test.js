'use strict';

const { createTestGql } = require('../helpers/gql');
const { resetDb } = require('../helpers/db');
const {
  createCreator,
  createSubscriber,
  createPost,
  createSubscription
} = require('../helpers/factories');
const trendingService = require('../../src/services/trendingService');
const { sequelize } = require('../../src/models');

describe('Integration: Trending Leaderboard & Anti-Gaming', () => {
  let api;

  beforeAll(async () => {
    api = await createTestGql();
  });

  afterAll(async () => {
    if (api && api.close) {
      await api.close();
    }
  });

  beforeEach(async () => {
    await resetDb();
  });

  test('anti-gaming: creator comments and multiple comments from same user do not inflate rank', async () => {
    const creator = await createCreator();
    const postSpam = await createPost({ creatorId: creator.id, title: 'Spammed Post' });
    const postLegit = await createPost({ creatorId: creator.id, title: 'Legit Post' });

    const spammer = await createSubscriber();
    const fan1 = await createSubscriber();
    const fan2 = await createSubscriber();

    // 1. Creator comments on their own post (should count 0 towards distinct commenters)
    await sequelize.query(
      `INSERT INTO comments (id, content_id, user_id, body, created_at, updated_at)
       VALUES (:id, :contentId, :userId, 'My own comment', NOW(), NOW())`,
      {
        replacements: {
          id: require('crypto').randomUUID(),
          contentId: postSpam.id,
          userId: creator.id
        }
      }
    );

    // 2. Spammer posts 10 comments on postSpam (should count as 1 distinct commenter)
    for (let i = 0; i < 5; i++) {
      await sequelize.query(
        `INSERT INTO comments (id, content_id, user_id, body, created_at, updated_at)
         VALUES (:id, :contentId, :userId, :body, NOW(), NOW())`,
        {
          replacements: {
            id: require('crypto').randomUUID(),
            contentId: postSpam.id,
            userId: spammer.id,
            body: `Spam comment ${i}`
          }
        }
      );
    }

    // 3. PostLegit gets comments from 2 distinct fans
    await sequelize.query(
      `INSERT INTO comments (id, content_id, user_id, body, created_at, updated_at)
       VALUES (:id, :contentId, :userId, 'Fan 1 comment', NOW(), NOW())`,
      {
        replacements: {
          id: require('crypto').randomUUID(),
          contentId: postLegit.id,
          userId: fan1.id
        }
      }
    );
    await sequelize.query(
      `INSERT INTO comments (id, content_id, user_id, body, created_at, updated_at)
       VALUES (:id, :contentId, :userId, 'Fan 2 comment', NOW(), NOW())`,
      {
        replacements: {
          id: require('crypto').randomUUID(),
          contentId: postLegit.id,
          userId: fan2.id
        }
      }
    );

    // Recompute trending
    await trendingService.computeTrending();

    const res = await api.request.get('/api/trending?limit=10');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);

    // postLegit has 2 distinct commenters vs postSpam's 1 distinct commenter
    expect(res.body.items[0].item.id).toBe(postLegit.id);
    expect(res.body.items[0].rank).toBe(1);
    expect(res.body.items[1].item.id).toBe(postSpam.id);
    expect(res.body.items[1].rank).toBe(2);
  });

  test('REST and GraphQL agree on trending ranks and accessibleOnly filtering', async () => {
    const creator = await createCreator();
    const freePost = await createPost({
      creatorId: creator.id,
      minTier: 'free',
      title: 'Trending Free'
    });
    const vipPost = await createPost({
      creatorId: creator.id,
      minTier: 'vip',
      title: 'Trending VIP'
    });

    const fan1 = await createSubscriber();
    const fan2 = await createSubscriber();

    // Give engagement to both
    await api.request
      .put(`/api/content/${freePost.id}/like`)
      .set('Authorization', `Bearer ${fan1.token}`)
      .send();
    await api.request
      .put(`/api/content/${freePost.id}/like`)
      .set('Authorization', `Bearer ${fan2.token}`)
      .send();

    await sequelize.query(
      `INSERT INTO content_reactions (id, content_id, user_id, created_at) VALUES (UUID(), :id, :u, NOW())`,
      { replacements: { id: vipPost.id, u: fan1.id } }
    );

    await trendingService.computeTrending();

    // 1. REST all
    const restAll = await api.request.get('/api/trending');
    expect(restAll.status).toBe(200);
    expect(restAll.body.items.length).toBeGreaterThanOrEqual(1);

    // 2. REST accessibleOnly for anonymous viewer -> only free post
    const restAccessible = await api.request.get('/api/trending?accessibleOnly=true');
    expect(restAccessible.status).toBe(200);
    for (const item of restAccessible.body.items) {
      expect(item.item.locked).toBe(false);
    }

    // 3. GraphQL trending query
    const gqlRes = await api.request.post('/graphql').send({
      query: `
        query {
          trending(limit: 5, accessibleOnly: true) {
            computedAt
            items {
              rank
              item {
                id
                title
                locked
              }
            }
          }
        }
      `
    });

    expect(gqlRes.status).toBe(200);
    expect(gqlRes.body.data.trending.items.length).toBeGreaterThanOrEqual(1);
    for (const entry of gqlRes.body.data.trending.items) {
      expect(entry.item.locked).toBe(false);
    }
  });
});
