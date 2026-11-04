// TODO(v0.6): Strip HTML after rich-text sanitisation arrives
const generateExcerpt = (text, maxLength = 200) => {
  if (!text) return '';
  return text.length <= maxLength ? text : text.slice(0, maxLength).trim();
};

/**
 * Format a content item based on viewer's access permissions.
 * Built from a strict allow-list of fields to guarantee locked items NEVER leak body text.
 * Shared between REST controllers and GraphQL resolvers for guaranteed byte-for-byte parity.
 *
 * @param {Object} params
 * @param {Object} params.item Content database model/object
 * @param {boolean} params.hasAccess Whether viewer has unlocked this content
 * @param {string} params.viewerTier Viewer's effective tier with creator ('free', 'pro', 'vip')
 * @returns {Object} Allow-listed presentation object
 */
const formatContentItem = ({ item, hasAccess, viewerTier }) => {
  const isLocked = !hasAccess;
  const excerpt = generateExcerpt(item.body, 200);

  return {
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
};

module.exports = {
  generateExcerpt,
  formatContentItem
};
