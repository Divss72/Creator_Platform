'use strict';

const {
  parseAnalyticsRange,
  fillContinuousTimeSeries,
  toUtcDateString
} = require('../../src/services/math/series');

describe('Unit: series', () => {
  const fixedNow = new Date('2026-11-10T12:00:00.000Z');

  describe('parseAnalyticsRange', () => {
    test('parses 7d range into exact UTC from/to boundaries and previous period', () => {
      const res = parseAnalyticsRange('7d', fixedNow);
      expect(res.range).toBe('7d');
      expect(res.daysCount).toBe(7);
      expect(res.to).toBe('2026-11-10');
      expect(res.from).toBe('2026-11-04');
      expect(res.prevTo).toBe('2026-11-03');
      expect(res.prevFrom).toBe('2026-10-28');
    });

    test('parses 30d range correctly', () => {
      const res = parseAnalyticsRange('30d', fixedNow);
      expect(res.daysCount).toBe(30);
      expect(res.to).toBe('2026-11-10');
      expect(res.from).toBe('2026-10-12');
    });

    test('parses 90d range correctly', () => {
      const res = parseAnalyticsRange('90d', fixedNow);
      expect(res.daysCount).toBe(90);
    });

    test('rejects unsupported range with descriptive error', () => {
      expect(() => parseAnalyticsRange('14d', fixedNow)).toThrow(/Invalid analytics range '14d'/);
      expect(() => parseAnalyticsRange('1y', fixedNow)).toThrow();
    });
  });

  describe('fillContinuousTimeSeries', () => {
    test('fills missing days with 0 flows and carries forward stock', () => {
      const from = '2026-11-01';
      const to = '2026-11-04';

      const existingDays = [
        {
          day: '2026-11-01',
          views: 10,
          lockedViews: 2,
          likes: 3,
          comments: 1,
          newSubscribers: 2,
          cancellations: 0,
          activeSubscribers: 2,
          freeSubscribers: 1,
          proSubscribers: 1,
          vipSubscribers: 0,
          mrrCents: 1500
        },
        // Missing 2026-11-02 and 2026-11-03
        {
          day: '2026-11-04',
          views: 5,
          lockedViews: 1,
          likes: 1,
          comments: 0,
          newSubscribers: 1,
          cancellations: 0,
          activeSubscribers: 3,
          freeSubscribers: 1,
          proSubscribers: 2,
          vipSubscribers: 0,
          mrrCents: 3000
        }
      ];

      const filled = fillContinuousTimeSeries({ from, to, existingDays });

      expect(filled).toHaveLength(4);
      expect(filled.map((d) => d.day)).toEqual([
        '2026-11-01',
        '2026-11-02',
        '2026-11-03',
        '2026-11-04'
      ]);

      // Missing day 2: flows are 0, stock carried forward from day 1
      const day2 = filled[1];
      expect(day2.day).toBe('2026-11-02');
      expect(day2.views).toBe(0);
      expect(day2.likes).toBe(0);
      expect(day2.activeSubscribers).toBe(2);
      expect(day2.byTier).toEqual({ free: 1, pro: 1, vip: 0 });
      expect(day2.mrrCents).toBe(1500);

      // Missing day 3: stock still carried forward
      const day3 = filled[2];
      expect(day3.activeSubscribers).toBe(2);
      expect(day3.mrrCents).toBe(1500);

      // Day 4 has new values
      const day4 = filled[3];
      expect(day4.views).toBe(5);
      expect(day4.activeSubscribers).toBe(3);
      expect(day4.mrrCents).toBe(3000);
    });

    test('handles completely empty days by seeding with initialStock', () => {
      const from = '2026-11-01';
      const to = '2026-11-02';
      const initialStock = {
        activeSubscribers: 5,
        byTier: { free: 3, pro: 2, vip: 0 },
        mrrCents: 3000
      };

      const filled = fillContinuousTimeSeries({ from, to, existingDays: [], initialStock });
      expect(filled).toHaveLength(2);
      expect(filled[0].activeSubscribers).toBe(5);
      expect(filled[1].activeSubscribers).toBe(5);
      expect(filled[0].views).toBe(0);
    });
  });
});
