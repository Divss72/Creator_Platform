'use strict';

const { generateViewerKey } = require('../../src/services/math/viewKey');

describe('Unit: viewKey', () => {
  const secret = 'a-secure-secret-key-that-is-at-least-32-characters-long!';

  test('produces identical 64-char hex key for identical inputs on the same day', () => {
    const key1 = generateViewerKey({
      secret,
      day: '2026-11-10',
      userId: 'user-uuid-1234'
    });
    const key2 = generateViewerKey({
      secret,
      day: '2026-11-10',
      userId: 'user-uuid-1234'
    });

    expect(key1).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(key1)).toBe(true);
    expect(key1).toBe(key2);
  });

  test('rotates daily: produces completely different key for different days with same user', () => {
    const keyDay1 = generateViewerKey({
      secret,
      day: '2026-11-10',
      userId: 'user-uuid-1234'
    });
    const keyDay2 = generateViewerKey({
      secret,
      day: '2026-11-11',
      userId: 'user-uuid-1234'
    });

    expect(keyDay1).not.toBe(keyDay2);
  });

  test('handles unauthenticated anonymous viewers with IP and User-Agent', () => {
    const keyAnon1 = generateViewerKey({
      secret,
      day: '2026-11-10',
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0 Chrome/120'
    });
    const keyAnon2 = generateViewerKey({
      secret,
      day: '2026-11-10',
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0 Chrome/120'
    });
    const keyDifferentIp = generateViewerKey({
      secret,
      day: '2026-11-10',
      ip: '192.168.1.101',
      userAgent: 'Mozilla/5.0 Chrome/120'
    });

    expect(keyAnon1).toBe(keyAnon2);
    expect(keyAnon1).not.toBe(keyDifferentIp);
  });

  test('never leaks raw IP or User-Agent in the generated hash output', () => {
    const ip = '198.51.100.42';
    const ua = 'SuperSecretBotVersion9.9';
    const key = generateViewerKey({
      secret,
      day: '2026-11-10',
      ip,
      userAgent: ua
    });

    expect(key).not.toContain(ip);
    expect(key).not.toContain(ua);
  });

  test('throws error if secret or day are missing', () => {
    expect(() => generateViewerKey({ day: '2026-11-10' })).toThrow(/secret is required/);
    expect(() => generateViewerKey({ secret })).toThrow(/day .* is required/);
  });
});
