'use strict';

const accessService = require('../../src/services/accessService');
const tierStore = require('../../src/store/tierStore');
const subscriptionStore = require('../../src/store/subscriptionStore');

jest.mock('../../src/store/tierStore');
jest.mock('../../src/store/subscriptionStore');

describe('Unit: accessService', () => {
  const mockTiers = [
    { id: 't-free', name: 'free', rank: 0, priceCents: 0 },
    { id: 't-pro', name: 'pro', rank: 1, priceCents: 999 },
    { id: 't-vip', name: 'vip', rank: 2, priceCents: 2999 }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    tierStore.findAll.mockResolvedValue(mockTiers);
    tierStore.getByName.mockImplementation(async (name) => {
      return mockTiers.find((t) => t.name === name) || null;
    });
    tierStore.findByName = tierStore.getByName;
  });

  // =========================================================================
  // 1. canAccess Matrix
  // =========================================================================
  describe('canAccess(viewerRank, requiredRank)', () => {
    const testCases = [
      // viewerRank, requiredRank, expected
      [0, 0, true],
      [0, 1, false],
      [0, 2, false],
      [1, 0, true],
      [1, 1, true],
      [1, 2, false],
      [2, 0, true],
      [2, 1, true],
      [2, 2, true],
      [3, 2, true],
      [-1, 0, false]
    ];

    test.each(testCases)(
      'canAccess(%i, %i) should return %s',
      (viewerRank, requiredRank, expected) => {
        expect(accessService.canAccess(viewerRank, requiredRank)).toBe(expected);
      }
    );

    test('returns false when arguments are invalid types', () => {
      expect(accessService.canAccess('1', 1)).toBe(false);
      expect(accessService.canAccess(1, '1')).toBe(false);
      expect(accessService.canAccess(null, 1)).toBe(false);
      expect(accessService.canAccess(1, undefined)).toBe(false);
      expect(accessService.canAccess(NaN, 1)).toBe(false);
    });
  });

  // =========================================================================
  // 2. resolveViewerTier Precedence & States
  // =========================================================================
  describe('resolveViewerTier', () => {
    const creatorId = 'creator-111';
    const otherCreatorId = 'creator-222';
    const viewerId = 'viewer-999';

    test('Owner Precedence: creator viewing own content always resolves to VIP (rank 2, source: owner)', async () => {
      const result = await accessService.resolveViewerTier({
        viewerId: creatorId,
        creatorId
      });

      expect(result).toEqual({
        tier: 'vip',
        rank: 2,
        source: 'owner'
      });
      // Should not even query subscriptions for owner
      expect(subscriptionStore.findBySubscriberAndCreator).not.toHaveBeenCalled();
    });

    test('Active Subscription: subscriber with active Pro subscription gets Pro (rank 1, source: subscription)', async () => {
      subscriptionStore.findBySubscriberAndCreator.mockResolvedValue({
        id: 'sub-1',
        subscriberId: viewerId,
        creatorId,
        tier: 'pro',
        tierRank: 1,
        status: 'active',
        startedAt: new Date(Date.now() - 100000),
        endsAt: null
      });

      const result = await accessService.resolveViewerTier({ viewerId, creatorId });

      expect(result).toEqual({
        tier: 'pro',
        rank: 1,
        source: 'subscription'
      });
    });

    test('Cancelled Subscription: falls back to Free (rank 0, source: none)', async () => {
      subscriptionStore.findBySubscriberAndCreator.mockResolvedValue({
        id: 'sub-2',
        subscriberId: viewerId,
        creatorId,
        tier: 'vip',
        tierRank: 2,
        status: 'cancelled',
        startedAt: new Date(Date.now() - 100000),
        endsAt: null
      });

      const result = await accessService.resolveViewerTier({ viewerId, creatorId });

      expect(result).toEqual({
        tier: 'free',
        rank: 0,
        source: 'none'
      });
    });

    test('Expired Subscription: endsAt in the past falls back to Free', async () => {
      subscriptionStore.findBySubscriberAndCreator.mockResolvedValue({
        id: 'sub-3',
        subscriberId: viewerId,
        creatorId,
        tier: 'vip',
        tierRank: 2,
        status: 'active',
        startedAt: new Date(Date.now() - 200000),
        endsAt: new Date(Date.now() - 50000)
      });

      const result = await accessService.resolveViewerTier({ viewerId, creatorId });

      expect(result).toEqual({
        tier: 'free',
        rank: 0,
        source: 'none'
      });
    });

    test('Per-Creator Isolation: Pro on Creator 1 gives Free on Creator 2', async () => {
      // Return sub for creatorId, but null for otherCreatorId
      subscriptionStore.findBySubscriberAndCreator.mockImplementation(async (subId, cId) => {
        if (cId === creatorId) {
          return {
            id: 'sub-1',
            subscriberId: subId,
            creatorId,
            tier: 'pro',
            tierRank: 1,
            status: 'active',
            endsAt: null
          };
        }
        return null;
      });

      const resCreator1 = await accessService.resolveViewerTier({ viewerId, creatorId });
      const resCreator2 = await accessService.resolveViewerTier({
        viewerId,
        creatorId: otherCreatorId
      });

      expect(resCreator1.tier).toBe('pro');
      expect(resCreator1.rank).toBe(1);
      expect(resCreator2.tier).toBe('free');
      expect(resCreator2.rank).toBe(0);
      expect(resCreator2.source).toBe('none');
    });

    test('Anonymous viewer (null viewerId) always resolves to Free', async () => {
      const result = await accessService.resolveViewerTier({ viewerId: null, creatorId });
      expect(result).toEqual({
        tier: 'free',
        rank: 0,
        source: 'none'
      });
    });
  });

  // =========================================================================
  // 3. resolveAccess (Single Content)
  // =========================================================================
  describe('resolveAccess', () => {
    const creatorId = 'creator-1';

    test('grants access to free content for anonymous viewer', async () => {
      const result = await accessService.resolveAccess({
        viewer: null,
        content: { creatorId, minTier: 'free' }
      });

      expect(result).toEqual({
        hasAccess: true,
        viewerTier: 'free',
        requiredTier: 'free'
      });
    });

    test('denies access to pro content for free subscriber', async () => {
      subscriptionStore.findBySubscriberAndCreator.mockResolvedValue(null);

      const result = await accessService.resolveAccess({
        viewer: { id: 'user-free' },
        content: { creatorId, minTier: 'pro' }
      });

      expect(result).toEqual({
        hasAccess: false,
        viewerTier: 'free',
        requiredTier: 'pro'
      });
    });

    test('grants access to pro content for vip subscriber', async () => {
      subscriptionStore.findBySubscriberAndCreator.mockResolvedValue({
        id: 'sub-vip',
        tier: 'vip',
        tierRank: 2,
        status: 'active',
        endsAt: null
      });

      const result = await accessService.resolveAccess({
        viewer: { id: 'user-vip' },
        content: { creatorId, minTier: 'pro' }
      });

      expect(result).toEqual({
        hasAccess: true,
        viewerTier: 'vip',
        requiredTier: 'pro'
      });
    });
  });

  // =========================================================================
  // 4. resolveAccessBulk (Single Query O(1) Guarantee)
  // =========================================================================
  describe('resolveAccessBulk', () => {
    test('returns empty map when contents list is empty', async () => {
      const result = await accessService.resolveAccessBulk({ viewer: null, contents: [] });
      expect(result.size).toBe(0);
      expect(subscriptionStore.findActiveByViewerAndCreators).not.toHaveBeenCalled();
    });

    test('executes subscription store query exactly ONCE for multiple creators and items', async () => {
      const viewer = { id: 'viewer-multi' };
      const contents = [
        { id: 'c-1', creatorId: 'creator-A', minTier: 'free' },
        { id: 'c-2', creatorId: 'creator-A', minTier: 'pro' },
        { id: 'c-3', creatorId: 'creator-B', minTier: 'pro' },
        { id: 'c-4', creatorId: 'creator-B', minTier: 'vip' },
        { id: 'c-5', creatorId: 'creator-C', minTier: 'vip' },
        { id: 'c-6', creatorId: 'viewer-multi', minTier: 'vip' } // Owner item
      ];

      const activeSubsMap = new Map([
        ['creator-A', { tier: 'pro', tierRank: 1 }],
        ['creator-B', { tier: 'vip', tierRank: 2 }]
      ]);

      subscriptionStore.findActiveByViewerAndCreators.mockResolvedValue(activeSubsMap);

      const resultMap = await accessService.resolveAccessBulk({ viewer, contents });

      // Verify the store was queried EXACTLY ONCE
      expect(subscriptionStore.findActiveByViewerAndCreators).toHaveBeenCalledTimes(1);
      expect(subscriptionStore.findActiveByViewerAndCreators).toHaveBeenCalledWith(
        'viewer-multi',
        expect.arrayContaining(['creator-A', 'creator-B', 'creator-C', 'viewer-multi'])
      );

      // Assert each item's resolution
      expect(resultMap.get('c-1')).toEqual({
        hasAccess: true,
        viewerTier: 'pro',
        requiredTier: 'free'
      });
      expect(resultMap.get('c-2')).toEqual({
        hasAccess: true,
        viewerTier: 'pro',
        requiredTier: 'pro'
      });
      expect(resultMap.get('c-3')).toEqual({
        hasAccess: true,
        viewerTier: 'vip',
        requiredTier: 'pro'
      });
      expect(resultMap.get('c-4')).toEqual({
        hasAccess: true,
        viewerTier: 'vip',
        requiredTier: 'vip'
      });
      expect(resultMap.get('c-5')).toEqual({
        hasAccess: false,
        viewerTier: 'free',
        requiredTier: 'vip'
      });
      expect(resultMap.get('c-6')).toEqual({
        hasAccess: true,
        viewerTier: 'vip',
        requiredTier: 'vip'
      }); // Owner
    });
  });

  // =========================================================================
  // 5. getViewerAccessProfile & resolveAccessFromProfile
  // =========================================================================
  describe('getViewerAccessProfile & resolveAccessFromProfile', () => {
    test('builds access profile for anonymous viewer without database query', async () => {
      const profile = await accessService.getViewerAccessProfile({ viewerId: null });
      expect(profile.viewerId).toBeNull();
      expect(profile.defaultRank).toBe(0);
      expect(profile.rankByCreatorId.size).toBe(0);
      expect(subscriptionStore.findActiveBySubscriber).not.toHaveBeenCalled();
    });

    test('builds access profile with active subscriptions map', async () => {
      subscriptionStore.findActiveBySubscriber.mockResolvedValue([
        { creatorId: 'creator-1', tierRank: 1 },
        { creatorId: 'creator-2', tierRank: 2 }
      ]);

      const profile = await accessService.getViewerAccessProfile({ viewerId: 'user-1' });

      expect(profile.viewerId).toBe('user-1');
      expect(profile.rankByCreatorId.get('creator-1')).toBe(1);
      expect(profile.rankByCreatorId.get('creator-2')).toBe(2);

      // Now resolve from pre-fetched profile
      const post1 = { id: 'p-1', creatorId: 'creator-1', minTier: 'pro' };
      const access1 = await accessService.resolveAccessFromProfile({ profile, content: post1 });
      expect(access1.hasAccess).toBe(true);
      expect(access1.viewerTier).toBe('pro');

      const post2Locked = { id: 'p-2', creatorId: 'creator-1', minTier: 'vip' };
      const access2 = await accessService.resolveAccessFromProfile({
        profile,
        content: post2Locked
      });
      expect(access2.hasAccess).toBe(false);
    });
  });

  // =========================================================================
  // 6. getEligibleSubscribers
  // =========================================================================
  describe('getEligibleSubscribers', () => {
    test('delegates parameters accurately to subscriptionStore.findEligibleSubscribers', async () => {
      subscriptionStore.findEligibleSubscribers.mockResolvedValue([
        { userId: 'u-1', email: 'u1@test.com', tierName: 'pro', tierRank: 1 }
      ]);

      const result = await accessService.getEligibleSubscribers({
        creatorId: 'creator-A',
        requiredRank: 1,
        afterUserId: 'u-0',
        limit: 50
      });

      expect(subscriptionStore.findEligibleSubscribers).toHaveBeenCalledWith({
        creatorId: 'creator-A',
        minTierRank: 1,
        afterUserId: 'u-0',
        limit: 50
      });
      expect(result).toHaveLength(1);
    });
  });
});
