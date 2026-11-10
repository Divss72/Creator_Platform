'use strict';

const { generateExcerpt, formatContentItem } = require('../../src/presenters/contentPresenter');

describe('Unit: contentPresenter', () => {
  const publicExcerptText =
    'Welcome to this post preview. This teaser is available to all readers.';
  const secretBodyMarker = 'TOP_SECRET_PRO_CONTENT_BODY_NEVER_LEAK_BEYOND_EXCERPT';
  const secretMediaUrl = 'https://res.cloudinary.com/demo/image/upload/v12345/top_secret.jpg';
  const fullBodyHtml = `<p>${publicExcerptText}</p><p>${'Long padding content '.repeat(20)}</p><p>${secretBodyMarker}</p>`;

  const mockItem = {
    id: 42,
    creatorId: 7,
    title: 'VIP Masterclass',
    body: fullBodyHtml,
    minTier: 'vip',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    creator: { id: 7, name: 'Alice VIP', handle: 'alice' }
  };

  const mockMedia = [
    {
      id: 101,
      contentId: 42,
      kind: 'image',
      url: secretMediaUrl,
      thumbnailUrl: 'https://res.cloudinary.com/demo/image/upload/c_thumb/top_secret.jpg',
      publicId: 'creators/7/secret_file',
      public_id: 'creators/7/secret_file',
      width: 1920,
      height: 1080,
      durationSeconds: null,
      bytes: 204800,
      position: 0
    },
    {
      id: 102,
      contentId: 42,
      kind: 'video',
      url: 'https://res.cloudinary.com/demo/video/upload/secret_video.mp4',
      thumbnailUrl: 'https://res.cloudinary.com/demo/video/upload/so_0/secret_video.jpg',
      publicId: 'creators/7/secret_video',
      public_id: 'creators/7/secret_video',
      width: 1280,
      height: 720,
      duration_seconds: 120, // snake_case coverage
      bytes: 10485760,
      position: 1
    }
  ];

  describe('generateExcerpt', () => {
    test('extracts plain text excerpt from rich HTML up to specified length', () => {
      const html =
        '<h1>Headline</h1> <p>This is a paragraph with <b>bold text</b> and <a href="#">links</a>.</p>';
      const excerpt = generateExcerpt(html, 50);
      expect(excerpt).toBe('Headline This is a paragraph with bold text and...');
    });

    test('handles empty or null text safely', () => {
      expect(generateExcerpt('')).toBe('');
      expect(generateExcerpt(null)).toBe('');
      expect(generateExcerpt(undefined)).toBe('');
    });
  });

  describe('formatContentItem - Unlocked Content (hasAccess: true)', () => {
    test('presents full body and formatted media attachments', () => {
      const presented = formatContentItem({
        item: mockItem,
        hasAccess: true,
        viewerTier: 'vip',
        mediaItems: mockMedia
      });

      expect(presented.locked).toBe(false);
      expect(presented.body).toBe(fullBodyHtml);
      expect(presented.viewerTier).toBe('vip');
      expect(presented.minTier).toBe('vip');
      expect(presented.media).toHaveLength(2);
      expect(presented.mediaCount).toBe(2);

      // Verify allow-list stripping on media items
      const firstMedia = presented.media[0];
      expect(firstMedia.id).toBe(101);
      expect(firstMedia.kind).toBe('image');
      expect(firstMedia.url).toBe(secretMediaUrl);
      expect(firstMedia.publicId).toBeUndefined();
      expect(firstMedia.public_id).toBeUndefined();

      // Verify snake_case duration fallback
      const secondMedia = presented.media[1];
      expect(secondMedia.id).toBe(102);
      expect(secondMedia.durationSeconds).toBe(120);
    });

    test('reads media attached directly to the item object if mediaItems not passed', () => {
      const itemWithMedia = { ...mockItem, media: mockMedia };
      const presented = formatContentItem({
        item: itemWithMedia,
        hasAccess: true,
        viewerTier: 'vip'
      });

      expect(presented.media).toHaveLength(2);
      expect(presented.mediaCount).toBe(2);
    });
  });

  describe('formatContentItem - Locked Content (hasAccess: false)', () => {
    test('suppresses body and strips media items while preserving metadata and mediaCount', () => {
      const presented = formatContentItem({
        item: mockItem,
        hasAccess: false,
        viewerTier: 'free',
        mediaItems: mockMedia
      });

      expect(presented.locked).toBe(true);
      expect(presented.body).toBeNull();
      expect(presented.viewerTier).toBe('free');
      expect(presented.media).toEqual([]);
      expect(presented.mediaCount).toBe(2);
      expect(typeof presented.excerpt).toBe('string');
      expect(presented.excerpt.length).toBeGreaterThan(0);
    });

    test('LOCKED SECRET SCAN: no body text or media URLs leak into serialized JSON', () => {
      const presented = formatContentItem({
        item: mockItem,
        hasAccess: false,
        viewerTier: 'free',
        mediaItems: mockMedia
      });

      const serialized = JSON.stringify(presented);

      expect(serialized).not.toContain(secretBodyMarker);
      expect(serialized).not.toContain(secretMediaUrl);
      expect(serialized).not.toContain('secret_video');
      expect(serialized).not.toContain('creators/7/secret_file');
    });

    test('handles content without media cleanly when locked', () => {
      const presented = formatContentItem({
        item: mockItem,
        hasAccess: false,
        viewerTier: 'free'
      });

      expect(presented.locked).toBe(true);
      expect(presented.body).toBeNull();
      expect(presented.media).toBeUndefined();
      expect(presented.mediaCount).toBeUndefined();
    });
  });
});
