const { contentStore } = require('../store');
const accessService = require('../services/accessService');
const ApiError = require('../utils/apiError');
const realtimeEvents = require('../realtime/events');

// TODO(v0.6): Strip HTML after rich-text sanitisation arrives
const generateExcerpt = (text, maxLength = 200) => {
  if (!text) return '';
  return text.length <= maxLength ? text : text.slice(0, maxLength).trim();
};

/**
 * Format a content item based on viewer's access permissions.
 * Built from a strict allow-list of fields to guarantee locked items NEVER leak body text.
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

/**
 * Create content (Creator only)
 */
const createContent = async (req, res) => {
  const { title, body, minTier = 'free' } = req.body;

  const content = await contentStore.create({
    creatorId: req.user.id,
    title,
    body,
    minTier
  });

  // Creator is always the owner of their created post
  const formatted = formatContentItem({
    item: content,
    hasAccess: true,
    viewerTier: 'vip'
  });

  res.status(201).json({
    content: formatted
  });
};

/**
 * List all content (Paginated feed with single-query bulk paywall resolution)
 */
const listContent = async (req, res) => {
  const { page, limit } = req.query;

  const result = await contentStore.findAll({ page, limit });

  // Resolve viewer's access across all creators on the page in ONE single query
  const accessMap = await accessService.resolveAccessBulk({
    viewer: req.user,
    contents: result.items
  });

  const items = result.items.map((item) => {
    const acc = accessMap.get(item.id) || { hasAccess: false, viewerTier: 'free' };
    return formatContentItem({
      item,
      hasAccess: acc.hasAccess,
      viewerTier: acc.viewerTier
    });
  });

  res.status(200).json({
    items,
    pagination: result.pagination
  });
};

/**
 * Get a single content item by ID (Preview vs Full Content)
 */
const getContentById = async (req, res) => {
  const { id } = req.params;

  const content = await contentStore.findById(id);
  if (!content) {
    throw ApiError.notFound('Content not found');
  }

  // Resolve access permission for viewer
  const access = await accessService.resolveAccess({
    viewer: req.user,
    content
  });

  // Locked item returns 200 with locked: true and body: null (preview)
  const formatted = formatContentItem({
    item: content,
    hasAccess: access.hasAccess,
    viewerTier: access.viewerTier
  });

  res.status(200).json({
    content: formatted
  });
};

/**
 * Update content item (Owner creator only)
 */
const updateContent = async (req, res) => {
  const { id } = req.params;
  const { title, body, minTier } = req.body;

  const existingContent = await contentStore.findById(id);
  if (!existingContent) {
    throw ApiError.notFound('Content not found');
  }

  // Ownership check: only creator who authored this post can edit
  if (existingContent.creatorId !== req.user.id) {
    throw ApiError.forbidden('You can only edit content you authored');
  }

  const updatedContent = await contentStore.update(id, {
    title,
    body,
    minTier
  });

  // Owner always has full access
  const formatted = formatContentItem({
    item: updatedContent,
    hasAccess: true,
    viewerTier: 'vip'
  });

  // Notify realtime layer to revalidate sockets if minTier changed
  try {
    await realtimeEvents.onContentUpdated({ contentId: id });
  } catch (err) {
    console.error('[Content Controller] Realtime notification error:', err.message);
  }

  res.status(200).json({
    content: formatted
  });
};

/**
 * Delete content item (Owner creator only)
 */
const deleteContent = async (req, res) => {
  const { id } = req.params;

  const existingContent = await contentStore.findById(id);
  if (!existingContent) {
    throw ApiError.notFound('Content not found');
  }

  // Ownership check: only creator who authored this post can delete
  if (existingContent.creatorId !== req.user.id) {
    throw ApiError.forbidden('You can only delete content you authored');
  }

  await contentStore.delete(id);

  // Notify realtime layer to emit post:deleted and clear room
  try {
    await realtimeEvents.onContentDeleted({ contentId: id });
  } catch (err) {
    console.error('[Content Controller] Realtime notification error:', err.message);
  }

  res.status(200).json({
    message: 'Content deleted successfully'
  });
};

module.exports = {
  createContent,
  listContent,
  getContentById,
  updateContent,
  deleteContent
};
