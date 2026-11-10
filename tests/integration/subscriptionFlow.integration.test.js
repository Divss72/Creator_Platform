'use strict';

const { createTestApi } = require('../helpers/api');
const { resetDb } = require('../helpers/db');
const { createCreator, createSubscriber, createPost } = require('../helpers/factories');
const { whenIdle } = require('../../src/events/domainEvents');
const firebaseSyncService = require('../../src/services/firebaseSyncService');
const { fakeDriver } = require('../../src/services/firebase');
const { outboxStore, subscriptionStore } = require('../../src/store');

describe('Integration: Subscription Flow & Paywall Transitions', () => {
  let api;

  beforeAll(() => {
    api = createTestApi();
  });

  beforeEach(async () => {
    await resetDb();
    fakeDriver.clear();
  });

  describe('Lifecycle: Create -> Upgrade -> Downgrade -> Idempotent -> Cancel -> Reactivate', () => {
    test('full subscription lifecycle with immediate side-effects and status consistency', async () => {
      const creator = await createCreator({ displayName: 'Tech Creator' });
      const subscriber = await createSubscriber({ name: 'Alice Subscriber' });

      // 1. Initial subscribe at FREE tier -> 201 Created
      const resCreate = await api.request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${subscriber.token}`)
        .send({ creatorId: creator.id, tier: 'free' });

      expect(resCreate.status).toBe(201);
      expect(resCreate.body.subscription).toBeDefined();
      expect(resCreate.body.subscription.subscriberId).toBe(subscriber.id);
      expect(resCreate.body.subscription.creatorId).toBe(creator.id);
      expect(resCreate.body.subscription.tier).toBe('free');
      expect(resCreate.body.subscription.status).toBe('active');

      // Verify domain events & side effects
      await whenIdle();
      await firebaseSyncService.flush();

      // Email Outbox verification (welcome email)
      const outboxRows = await outboxStore.listByUserId(subscriber.id);
      expect(outboxRows.length).toBeGreaterThanOrEqual(1);
      const welcomeMail = outboxRows.find((r) => r.type === 'welcome');
      expect(welcomeMail).toBeDefined();
      expect(welcomeMail.toEmail).toBe(subscriber.email.toLowerCase());

      // Firebase RTDB verification
      const fbDataAfterCreate = await fakeDriver.get(`creatorStats/${creator.id}`);
      expect(fbDataAfterCreate.subscriberCount).toBe(1);
      expect(fbDataAfterCreate.byTier).toEqual({
        free: 1,
        pro: 0,
        vip: 0
      });

      // 2. Upgrade from FREE to PRO -> 200 OK
      const resUpgradePro = await api.request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${subscriber.token}`)
        .send({ creatorId: creator.id, tier: 'pro' });

      expect(resUpgradePro.status).toBe(200);
      expect(resUpgradePro.body.subscription.tier).toBe('pro');
      expect(resUpgradePro.body.subscription.status).toBe('active');

      await whenIdle();
      await firebaseSyncService.flush();

      const fbDataAfterPro = await fakeDriver.get(`creatorStats/${creator.id}`);
      expect(fbDataAfterPro.subscriberCount).toBe(1);
      expect(fbDataAfterPro.byTier).toEqual({
        free: 0,
        pro: 1,
        vip: 0
      });

      // 3. Upgrade from PRO to VIP -> 200 OK
      const resUpgradeVip = await api.request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${subscriber.token}`)
        .send({ creatorId: creator.id, tier: 'vip' });

      expect(resUpgradeVip.status).toBe(200);
      expect(resUpgradeVip.body.subscription.tier).toBe('vip');

      await whenIdle();
      await firebaseSyncService.flush();

      const fbDataAfterVip = await fakeDriver.get(`creatorStats/${creator.id}`);
      expect(fbDataAfterVip.subscriberCount).toBe(1);
      expect(fbDataAfterVip.byTier).toEqual({
        free: 0,
        pro: 0,
        vip: 1
      });

      // 4. Downgrade from VIP to PRO -> 200 OK
      const resDowngrade = await api.request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${subscriber.token}`)
        .send({ creatorId: creator.id, tier: 'pro' });

      expect(resDowngrade.status).toBe(200);
      expect(resDowngrade.body.subscription.tier).toBe('pro');

      await whenIdle();
      await firebaseSyncService.flush();

      const fbDataAfterDowngrade = await fakeDriver.get(`creatorStats/${creator.id}`);
      expect(fbDataAfterDowngrade.subscriberCount).toBe(1);
      expect(fbDataAfterDowngrade.byTier).toEqual({
        free: 0,
        pro: 1,
        vip: 0
      });

      // 5. Idempotent repeat subscribe at PRO tier -> 200 OK without duplication
      const resRepeat = await api.request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${subscriber.token}`)
        .send({ creatorId: creator.id, tier: 'pro' });

      expect(resRepeat.status).toBe(200);
      expect(resRepeat.body.subscription.tier).toBe('pro');

      await whenIdle();
      await firebaseSyncService.flush();

      const fbDataAfterRepeat = await fakeDriver.get(`creatorStats/${creator.id}`);
      expect(fbDataAfterRepeat.subscriberCount).toBe(1);
      expect(fbDataAfterRepeat.byTier).toEqual({
        free: 0,
        pro: 1,
        vip: 0
      });

      // 6. Cancel subscription -> 200 OK
      const resCancel = await api.request
        .delete(`/api/subscriptions/${creator.id}`)
        .set('Authorization', `Bearer ${subscriber.token}`);

      expect(resCancel.status).toBe(200);
      expect(resCancel.body.subscription.status).toBe('cancelled');

      // Check /api/subscriptions/me
      const resMySubs = await api.request
        .get('/api/subscriptions/me')
        .set('Authorization', `Bearer ${subscriber.token}`);

      expect(resMySubs.status).toBe(200);
      expect(resMySubs.body.subscriptions).toHaveLength(1);
      expect(resMySubs.body.subscriptions[0].status).toBe('cancelled');

      await whenIdle();
      await firebaseSyncService.flush();

      const fbDataAfterCancel = await fakeDriver.get(`creatorStats/${creator.id}`);
      expect(fbDataAfterCancel.subscriberCount).toBe(0);
      expect(fbDataAfterCancel.byTier).toEqual({
        free: 0,
        pro: 0,
        vip: 0
      });

      // 7. Reactivate cancelled subscription -> 200 OK
      const resReactivate = await api.request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${subscriber.token}`)
        .send({ creatorId: creator.id, tier: 'vip' });

      expect(resReactivate.status).toBe(200);
      expect(resReactivate.body.subscription.status).toBe('active');
      expect(resReactivate.body.subscription.tier).toBe('vip');

      await whenIdle();
      await firebaseSyncService.flush();

      const fbDataAfterReactivate = await fakeDriver.get(`creatorStats/${creator.id}`);
      expect(fbDataAfterReactivate.subscriberCount).toBe(1);
      expect(fbDataAfterReactivate.byTier).toEqual({
        free: 0,
        pro: 0,
        vip: 1
      });
    });
  });

  describe('Immediate Access Reflection across State Changes', () => {
    test('tier transitions immediately update post access and content visibility', async () => {
      const creator = await createCreator();
      const subscriber = await createSubscriber();

      const freePost = await createPost({
        creatorId: creator.id,
        minTier: 'free',
        title: 'Free Post',
        body: '<p>Free Content Body</p>'
      });
      const proPost = await createPost({
        creatorId: creator.id,
        minTier: 'pro',
        title: 'Pro Post',
        body: '<p>Pro Secret Exclusive Body</p>'
      });
      const vipPost = await createPost({
        creatorId: creator.id,
        minTier: 'vip',
        title: 'VIP Post',
        body: '<p>VIP Masterclass Secret Body</p>'
      });

      // A. Before any subscription:
      // Can access free post, but pro and vip are locked
      const resInitPro = await api.request
        .get(`/api/content/${proPost.id}`)
        .set('Authorization', `Bearer ${subscriber.token}`);
      expect(resInitPro.status).toBe(200);
      expect(resInitPro.body.content.locked).toBe(true);
      expect(resInitPro.body.content.body).toBeNull();

      const resInitFree = await api.request
        .get(`/api/content/${freePost.id}`)
        .set('Authorization', `Bearer ${subscriber.token}`);
      expect(resInitFree.status).toBe(200);
      expect(resInitFree.body.content.locked).toBe(false);
      expect(resInitFree.body.content.body).toBe('<p>Free Content Body</p>');

      // B. Subscribe to PRO:
      await api.request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${subscriber.token}`)
        .send({ creatorId: creator.id, tier: 'pro' });

      // Immediate check: pro post is now unlocked
      const resProUnlocked = await api.request
        .get(`/api/content/${proPost.id}`)
        .set('Authorization', `Bearer ${subscriber.token}`);
      expect(resProUnlocked.status).toBe(200);
      expect(resProUnlocked.body.content.locked).toBe(false);
      expect(resProUnlocked.body.content.body).toBe('<p>Pro Secret Exclusive Body</p>');

      // VIP post is still locked
      const resVipLocked = await api.request
        .get(`/api/content/${vipPost.id}`)
        .set('Authorization', `Bearer ${subscriber.token}`);
      expect(resVipLocked.status).toBe(200);
      expect(resVipLocked.body.content.locked).toBe(true);
      expect(resVipLocked.body.content.body).toBeNull();

      // C. Upgrade to VIP:
      await api.request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${subscriber.token}`)
        .send({ creatorId: creator.id, tier: 'vip' });

      // VIP post is now unlocked
      const resVipUnlocked = await api.request
        .get(`/api/content/${vipPost.id}`)
        .set('Authorization', `Bearer ${subscriber.token}`);
      expect(resVipUnlocked.status).toBe(200);
      expect(resVipUnlocked.body.content.locked).toBe(false);
      expect(resVipUnlocked.body.content.body).toBe('<p>VIP Masterclass Secret Body</p>');

      // D. Cancel Subscription:
      await api.request
        .delete(`/api/subscriptions/${creator.id}`)
        .set('Authorization', `Bearer ${subscriber.token}`);

      // Both Pro and VIP immediately revert to locked
      const resProRelocked = await api.request
        .get(`/api/content/${proPost.id}`)
        .set('Authorization', `Bearer ${subscriber.token}`);
      expect(resProRelocked.status).toBe(200);
      expect(resProRelocked.body.content.locked).toBe(true);
      expect(resProRelocked.body.content.body).toBeNull();

      const resVipRelocked = await api.request
        .get(`/api/content/${vipPost.id}`)
        .set('Authorization', `Bearer ${subscriber.token}`);
      expect(resVipRelocked.status).toBe(200);
      expect(resVipRelocked.body.content.locked).toBe(true);
      expect(resVipRelocked.body.content.body).toBeNull();
    });
  });

  describe('Concurrency & Race Condition Handling', () => {
    test('concurrent subscription requests for the same pair resolve to exactly 1 record', async () => {
      const creator = await createCreator();
      const subscriber = await createSubscriber();

      // Fire 3 concurrent subscribe calls for different tiers
      const results = await Promise.all([
        api.request
          .post('/api/subscriptions')
          .set('Authorization', `Bearer ${subscriber.token}`)
          .send({ creatorId: creator.id, tier: 'free' }),
        api.request
          .post('/api/subscriptions')
          .set('Authorization', `Bearer ${subscriber.token}`)
          .send({ creatorId: creator.id, tier: 'pro' }),
        api.request
          .post('/api/subscriptions')
          .set('Authorization', `Bearer ${subscriber.token}`)
          .send({ creatorId: creator.id, tier: 'vip' })
      ]);

      // All requests must return either 200 or 201 without 500 server errors
      for (const res of results) {
        expect([200, 201]).toContain(res.status);
      }

      // Verify that database has exactly ONE subscription record for this subscriber and creator
      const sub = await subscriptionStore.findBySubscriberAndCreator(subscriber.id, creator.id);
      expect(sub).toBeDefined();
      expect(['free', 'pro', 'vip']).toContain(sub.tier);
      expect(sub.status).toBe('active');

      const allSubs = await subscriptionStore.listBySubscriber(subscriber.id);
      expect(allSubs).toHaveLength(1);
    });
  });

  describe('Authorization & Validation Guards', () => {
    test('rejects unauthenticated requests with 401', async () => {
      const creator = await createCreator();
      const res = await api.request
        .post('/api/subscriptions')
        .send({ creatorId: creator.id, tier: 'free' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    test('rejects creators trying to subscribe with 403 Forbidden', async () => {
      const creatorA = await createCreator();
      const creatorB = await createCreator();

      const res = await api.request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${creatorA.token}`)
        .send({ creatorId: creatorB.id, tier: 'free' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('rejects non-existent creator with 404 Not Found', async () => {
      const subscriber = await createSubscriber();
      const nonExistentUuid = '00000000-0000-4000-8000-000000000000';

      const res = await api.request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${subscriber.token}`)
        .send({ creatorId: nonExistentUuid, tier: 'free' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    test('rejects invalid creatorId format with 400 Bad Request', async () => {
      const subscriber = await createSubscriber();

      const res = await api.request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${subscriber.token}`)
        .send({ creatorId: 'not-a-valid-uuid', tier: 'free' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('rejects invalid tier name with 400 Bad Request', async () => {
      const creator = await createCreator();
      const subscriber = await createSubscriber();

      const res = await api.request
        .post('/api/subscriptions')
        .set('Authorization', `Bearer ${subscriber.token}`)
        .send({ creatorId: creator.id, tier: 'ultra_diamond' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('cancelling a non-existent subscription returns 404 Not Found', async () => {
      const creator = await createCreator();
      const subscriber = await createSubscriber();

      const res = await api.request
        .delete(`/api/subscriptions/${creator.id}`)
        .set('Authorization', `Bearer ${subscriber.token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});

