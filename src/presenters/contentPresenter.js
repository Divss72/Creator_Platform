'use strict';

const { generatePlainTextExcerpt } = require('../services/sanitizeService');

const generateExcerpt = (text, maxLength = 200) => {
  return generatePlainTextExcerpt(text, maxLength);
};

/**
 * Format a content item based on viewer's access permissions.
 * Built from a strict allow-list of fields to guarantee locked items NEVER leak body text or media.
 * Shared between REST controllers and GraphQL resolvers for guaranteed byte-for-byte parity.
 *
 * @param {Object} params
 * @param {Object} params.item Content database model/object
 * @param {boolean} params.hasAccess Whether viewer has unlocked this content
 * @param {string} params.viewerTier Viewer's effective tier with creator ('free', 'pro', 'vip')
 * @param {Array} [params.mediaItems] Optional media attachments belonging to this content
 * @returns {Object} Allow-listed presentation object
 */
const formatContentItem = ({ item, hasAccess, viewerTier, mediaItems = null }) => {
  const isLocked = !hasAccess;
  const excerpt = generateExcerpt(item.body, 200);

  // If item already carries media or media is passed in
  const allMedia = mediaItems !== null ? mediaItems : item.media;
  const mediaCount =
    item.mediaCount !== undefined
      ? item.mediaCount
      : allMedia !== undefined
        ? allMedia.length
        : undefined;

  // Media allow-list: never expose public_id
  const formattedMedia =
    allMedia !== undefined
      ? isLocked
        ? []
        : allMedia.map((m) => ({
            id: m.id,
            kind: m.kind,
            url: m.url,
            thumbnailUrl: m.thumbnailUrl,
            width: m.width !== undefined ? m.width : null,
            height: m.height !== undefined ? m.height : null,
            durationSeconds:
              m.durationSeconds !== undefined
                ? m.durationSeconds
                : m.duration_seconds !== undefined
                  ? m.duration_seconds
                  : null,
            bytes: m.bytes,
            position: m.position
          }))
      : undefined;

  const result = {
    id: item.id,
    creatorId: item.creatorId,
    title: item.title,
    body: isLocked ? null : item.body,
    excerpt,
    minTier: item.minTier,
    locked: isLocked,
    viewerTier,
    creator: item.creator,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };

  if (item.likeCount !== undefined) {
    result.likeCount = Number(item.likeCount);
  }
  if (item.likedByMe !== undefined) {
    result.likedByMe = Boolean(item.likedByMe);
  }
  if (item.commentCount !== undefined) {
    result.commentCount = Number(item.commentCount);
  }

  if (formattedMedia !== undefined) {
    result.media = formattedMedia;
  }
  if (mediaCount !== undefined) {
    result.mediaCount = mediaCount;
  }

  return result;
};

module.exports = {
  generateExcerpt,
  formatContentItem
};
