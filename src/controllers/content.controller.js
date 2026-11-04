'use strict';

const { contentStore } = require('../store');
const mediaStore = require('../store/mediaStore');
const mediaService = require('../services/mediaService');
const accessService = require('../services/accessService');
const ApiError = require('../utils/apiError');
const realtimeEvents = require('../realtime/events');
const { formatContentItem } = require('../presenters/contentPresenter');
const { sanitizeRichText, cleanPlainText } = require('../services/sanitizeService');

/**
 * Create content (Creator only)
 */
const createContent = async (req, res) => {
  const { title, body, minTier = 'free' } = req.body;

  const cleanedTitle = cleanPlainText(title, { maxLength: 200, fieldName: 'Title' });
  const sanitizedBody = sanitizeRichText(body);

  const content = await contentStore.create({
    creatorId: req.user.id,
    title: cleanedTitle,
    body: sanitizedBody,
    minTier
  });

  // Creator is always the owner of their created post
  const formatted = formatContentItem({
    item: { ...content, mediaCount: 0 },
    hasAccess: true,
    viewerTier: 'vip',
    mediaItems: []
  });

  res.status(201).json({
    content: formatted
  });
};

/**
 * List all content (Paginated feed with single-query bulk paywall resolution and batched media loading)
 */
const listContent = async (req, res) => {
  const { page, limit } = req.query;

  const result = await contentStore.findAll({ page, limit });

  // 1. Resolve viewer's access across all creators on the page in ONE single query
  const accessMap = await accessService.resolveAccessBulk({
    viewer: req.user,
    contents: result.items
  });

  // 2. Load all media for the page in ONE single batched query (no N+1)
  const contentIds = result.items.map((i) => i.id);
  const mediaMap = await mediaStore.listByContentIds(contentIds);

  const items = result.items.map((item) => {
    const acc = accessMap.get(item.id) || { hasAccess: false, viewerTier: 'free' };
    const rawMedia = mediaMap.get(item.id) || [];
    const signedMedia = mediaService.signMediaList(rawMedia, acc.hasAccess);

    return formatContentItem({
      item: { ...item, mediaCount: rawMedia.length },
      hasAccess: acc.hasAccess,
      viewerTier: acc.viewerTier,
      mediaItems: signedMedia
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

  // Load media items for this post
  const rawMedia = await mediaStore.findByContentId(id);
  const signedMedia = mediaService.signMediaList(rawMedia, access.hasAccess);

  // Locked item returns 200 with locked: true, body: null, media: [] (preview)
  const formatted = formatContentItem({
    item: { ...content, mediaCount: rawMedia.length },
    hasAccess: access.hasAccess,
    viewerTier: access.viewerTier,
    mediaItems: signedMedia
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

  const updateData = {};
  if (title !== undefined) {
    updateData.title = cleanPlainText(title, { maxLength: 200, fieldName: 'Title' });
  }
  if (body !== undefined) {
    updateData.body = sanitizeRichText(body);
  }
  if (minTier !== undefined) {
    updateData.minTier = minTier;
  }

  const updatedContent = await contentStore.update(id, updateData);
  const rawMedia = await mediaStore.findByContentId(id);
  const signedMedia = mediaService.signMediaList(rawMedia, true);

  // Owner always has full access
  const formatted = formatContentItem({
    item: { ...updatedContent, mediaCount: rawMedia.length },
    hasAccess: true,
    viewerTier: 'vip',
    mediaItems: signedMedia
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

  // Clean up media assets from storage driver
  try {
    await mediaService.onPostDeleted(id);
  } catch (err) {
    console.warn('[Content Deletion] Media cleanup warning for post %s:', id, err.message);
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
