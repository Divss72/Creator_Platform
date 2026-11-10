'use strict';

const { createTestGql } = require('../helpers/gql');
const { resetDb } = require('../helpers/db');
const {
  createCreator,
  createSubscriber,
  createPost,
  createSubscription
} = require('../helpers/factories');

describe('Integration: Likes & Reactions', () => {
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

  test('liking requires full read access to the post', async () => {
    const creator = await createCreator();
    const proPost = await createPost({ creatorId: creator.id, minTier: 'pro' });

    const freeSub = await createSubscriber();
    const proSub = await createSubscriber();
    await createSubscription({ subscriberId: proSub.id, creatorId: creator.id, tier: 'pro' });

    // Free subscriber cannot like locked pro post
    const failRes = await api.request
      .put(`/api/content/${proPost.id}/like`)
      .set('Authorization', `Bearer ${freeSub.token}`)
      .send();

    expect(failRes.status).toBe(403);

    // Pro subscriber can like unlocked pro post
    const successRes = await api.request
      .put(`/api/content/${proPost.id}/like`)
      .set('Authorization', `Bearer ${proSub.token}`)
      .send();

    expect(successRes.status).toBe(200);
    expect(successRes.body.liked).toBe(true);
    expect(successRes.body.likeCount).toBe(1);
  });

  test('creator self-like is rejected with 403', async () => {
    const creator = await createCreator();
    const post = await createPost({ creatorId: creator.id, minTier: 'free' });

    const res = await api.request
      .put(`/api/content/${post.id}/like`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send();

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/cannot like their own/i);
  });

  test('PUT and DELETE /like are idempotent', async () => {
    const creator = await createCreator();
    const post = await createPost({ creatorId: creator.id, minTier: 'free' });
    const sub = await createSubscriber();

    // First like
    const like1 = await api.request
      .put(`/api/content/${post.id}/like`)
      .set('Authorization', `Bearer ${sub.token}`)
      .send();
    expect(like1.status).toBe(200);
    expect(like1.body.likeCount).toBe(1);

    // Second like (idempotent)
    const like2 = await api.request
      .put(`/api/content/${post.id}/like`)
      .set('Authorization', `Bearer ${sub.token}`)
      .send();
    expect(like2.status).toBe(200);
    expect(like2.body.likeCount).toBe(1);

    // First unlike
    const unlike1 = await api.request
      .delete(`/api/content/${post.id}/like`)
      .set('Authorization', `Bearer ${sub.token}`)
      .send();
    expect(unlike1.status).toBe(200);
    expect(unlike1.body.liked).toBe(false);
    expect(unlike1.body.likeCount).toBe(0);

    // Second unlike (idempotent)
    const unlike2 = await api.request
      .delete(`/api/content/${post.id}/like`)
      .set('Authorization', `Bearer ${sub.token}`)
      .send();
    expect(unlike2.status).toBe(200);
    expect(unlike2.body.liked).toBe(false);
    expect(unlike2.body.likeCount).toBe(0);
  });

  test('REST and GraphQL reflect likeCount and likedByMe consistently', async () => {
    const creator = await createCreator();
    const post = await createPost({ creatorId: creator.id, minTier: 'free' });
    const subA = await createSubscriber();
    const subB = await createSubscriber();

    // Sub A likes post
    await api.request
      .put(`/api/content/${post.id}/like`)
      .set('Authorization', `Bearer ${subA.token}`)
      .send();

    // 1. REST check for Sub A
    const restSubA = await api.request
      .get(`/api/content/${post.id}`)
      .set('Authorization', `Bearer ${subA.token}`)
      .send();
    expect(restSubA.body.content.likeCount).toBe(1);
    expect(restSubA.body.content.likedByMe).toBe(true);

    // 2. REST check for Sub B (did not like)
    const restSubB = await api.request
      .get(`/api/content/${post.id}`)
      .set('Authorization', `Bearer ${subB.token}`)
      .send();
    expect(restSubB.body.content.likeCount).toBe(1);
    expect(restSubB.body.content.likedByMe).toBe(false);

    // 3. GraphQL check for Sub A
    const gqlQuery = {
      query: `
        query GetContent($id: ID!) {
          content(id: $id) {
            id
            likeCount
            likedByMe
          }
        }
      `,
      variables: { id: post.id }
    };

    const gqlSubA = await api.request
      .post('/graphql')
      .set('Authorization', `Bearer ${subA.token}`)
      .send(gqlQuery);
    expect(gqlSubA.body.data.content.likeCount).toBe(1);
    expect(gqlSubA.body.data.content.likedByMe).toBe(true);

    // 4. GraphQL check for Sub B
    const gqlSubB = await api.request
      .post('/graphql')
      .set('Authorization', `Bearer ${subB.token}`)
      .send(gqlQuery);
    expect(gqlSubB.body.data.content.likeCount).toBe(1);
    expect(gqlSubB.body.data.content.likedByMe).toBe(false);
  });
});
