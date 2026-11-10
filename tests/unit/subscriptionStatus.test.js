'use strict';

const { isActiveSubscription } = require('../../src/utils/subscriptionStatus');

describe('Unit: subscriptionStatus (isActiveSubscription)', () => {
  const baseTime = new Date('2026-11-10T12:00:00.000Z');

  test('returns true for active subscription with null ends_at', () => {
    const sub = {
      status: 'active',
      startedAt: new Date(baseTime.getTime() - 86400000),
      endsAt: null
    };
    expect(isActiveSubscription(sub, { now: baseTime })).toBe(true);
  });

  test('returns true for active subscription with future ends_at', () => {
    const sub = {
      status: 'active',
      startedAt: new Date(baseTime.getTime() - 86400000),
      endsAt: new Date(baseTime.getTime() + 86400000)
    };
    expect(isActiveSubscription(sub, { now: baseTime })).toBe(true);
  });

  test('returns false for cancelled status even with future ends_at', () => {
    const sub = {
      status: 'cancelled',
      startedAt: new Date(baseTime.getTime() - 86400000),
      endsAt: new Date(baseTime.getTime() + 86400000)
    };
    expect(isActiveSubscription(sub, { now: baseTime })).toBe(false);
  });

  test('returns false for expired status', () => {
    const sub = {
      status: 'expired',
      startedAt: new Date(baseTime.getTime() - 86400000),
      endsAt: new Date(baseTime.getTime() - 1000)
    };
    expect(isActiveSubscription(sub, { now: baseTime })).toBe(false);
  });

  test('boundary: returns false when ends_at equals now exactly', () => {
    const sub = {
      status: 'active',
      startedAt: new Date(baseTime.getTime() - 86400000),
      endsAt: baseTime
    };
    expect(isActiveSubscription(sub, { now: baseTime })).toBe(false);
  });

  test('returns false when ends_at is in the past', () => {
    const sub = {
      status: 'active',
      startedAt: new Date(baseTime.getTime() - 86400000),
      endsAt: new Date(baseTime.getTime() - 1000)
    };
    expect(isActiveSubscription(sub, { now: baseTime })).toBe(false);
  });

  test('returns false when subscription object is null or undefined', () => {
    expect(isActiveSubscription(null)).toBe(false);
    expect(isActiveSubscription(undefined)).toBe(false);
  });

  test('supports snake_case ends_at and started_at properties from raw SQL', () => {
    const sub = {
      status: 'active',
      started_at: new Date(baseTime.getTime() - 86400000),
      ends_at: new Date(baseTime.getTime() + 86400000)
    };
    expect(isActiveSubscription(sub, { now: baseTime })).toBe(true);
  });
});
