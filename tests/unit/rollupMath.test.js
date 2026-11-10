'use strict';

const {
  computeDailyEventDeltas,
  applyStockDeltas,
  calculateEstimatedMrrCents,
  calculateChangePct,
  calculateChurnRate
} = require('../../src/services/math/rollupMath');

describe('Unit: rollupMath', () => {
  const tierIdToName = new Map([
    ['tier-id-free', 'free'],
    ['tier-id-pro', 'pro'],
    ['tier-id-vip', 'vip']
  ]);

  describe('computeDailyEventDeltas', () => {
    test('computes correct deltas for created, tier_changed, reactivated, and cancelled events', () => {
      const events = [
        { event: 'created', toTierId: 'tier-id-pro' },
        { event: 'created', toTierId: 'tier-id-vip' },
        { event: 'reactivated', toTierId: 'tier-id-free' },
        { event: 'tier_changed', fromTierId: 'tier-id-pro', toTierId: 'tier-id-vip' },
        { event: 'cancelled', fromTierId: 'tier-id-free' }
      ];

      const res = computeDailyEventDeltas(events, tierIdToName);

      expect(res.newSubscribers).toBe(3); // 2 created + 1 reactivated
      expect(res.cancellations).toBe(1); // 1 cancelled

      // Net deltas:
      // free: +1 (reactivated) - 1 (cancelled) = 0
      // pro: +1 (created) - 1 (tier_changed) = 0
      // vip: +1 (created) + 1 (tier_changed) = +2
      // total: +1 + 1 + 1 - 1 = +2
      expect(res.deltas).toEqual({
        free: 0,
        pro: 0,
        vip: 2,
        total: 2
      });
    });

    test('handles empty events cleanly', () => {
      const res = computeDailyEventDeltas([], tierIdToName);
      expect(res.newSubscribers).toBe(0);
      expect(res.cancellations).toBe(0);
      expect(res.deltas).toEqual({ free: 0, pro: 0, vip: 0, total: 0 });
    });
  });

  describe('applyStockDeltas', () => {
    test('carries forward previous stock and adds deltas', () => {
      const prevStock = { free: 10, pro: 5, vip: 2, total: 17 };
      const deltas = { free: -2, pro: 3, vip: 1, total: 2 };

      const newStock = applyStockDeltas(prevStock, deltas);
      expect(newStock).toEqual({
        free: 8,
        pro: 8,
        vip: 3,
        total: 19
      });
    });

    test('clamps negative values to zero to prevent negative subscriber counts', () => {
      const prevStock = { free: 1, pro: 0, vip: 0, total: 1 };
      const deltas = { free: -5, pro: -2, vip: 0, total: -7 };

      const newStock = applyStockDeltas(prevStock, deltas);
      expect(newStock.free).toBe(0);
      expect(newStock.pro).toBe(0);
      expect(newStock.total).toBe(0);
    });
  });

  describe('calculateEstimatedMrrCents', () => {
    test('calculates correct MRR using current tier pricing in cents', () => {
      // 10 Pro ($15 = 1500c) + 2 VIP ($50 = 5000c) = 15,000 + 10,000 = 25,000 cents ($250)
      const mrr = calculateEstimatedMrrCents(
        { free: 100, pro: 10, vip: 2 },
        { free: 0, pro: 1500, vip: 5000 }
      );
      expect(mrr).toBe(25000);
    });

    test('handles missing or zero subscriber counts', () => {
      expect(calculateEstimatedMrrCents({})).toBe(0);
    });
  });

  describe('calculateChangePct & calculateChurnRate', () => {
    test('calculates percentage change correctly', () => {
      expect(calculateChangePct(120, 100)).toBe(20);
      expect(calculateChangePct(80, 100)).toBe(-20);
    });

    test('returns null when previous value is 0 or invalid', () => {
      expect(calculateChangePct(50, 0)).toBeNull();
      expect(calculateChangePct(50, null)).toBeNull();
    });

    test('calculates churn rate correctly', () => {
      // 5 cancellations out of 50 active at start = 0.1 (10%)
      expect(calculateChurnRate(5, 50)).toBe(0.1);
    });

    test('returns null when active at start is 0 or non-positive', () => {
      expect(calculateChurnRate(2, 0)).toBeNull();
      expect(calculateChurnRate(2, -1)).toBeNull();
    });
  });
});
