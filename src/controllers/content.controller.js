'use strict';

const { contentStore, reactionStore, commentStore } = require('../store');
const mediaStore = require('../store/mediaStore');
const mediaService = require('../services/mediaService');
const accessService = require('../services/accessService');
const ApiError = require('../utils/apiError');
const realtimeEvents = require('../realtime/events');
const { formatContentItem } = require('../presenters/contentPresenter');
const { sanitizeRichText, cleanPlainText } = require('../services/sanitizeService');
const { emitContentCreated } = require('../events/domainEvents');

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

  // Emit domain event for side effects (new post email fan-out)
  emitContentCreated({
    contentId: content.id,
    creatorId: req.user.id,
    title: cleanedTitle,
    minTier,
    excerpt: formatted.excerpt || '',
    publishedAt: content.createdAt
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

  // 2. Load media, likes, and comment counts for the page in parallel batched queries (no N+1)
  const contentIds = result.items.map((i) => i.id);
  const [mediaMap, likesMap, commentsMap] = await Promise.all([
    mediaStore.listByContentIds(contentIds),
    reactionStore.batchGetLikes(contentIds, req.user ? req.user.id : null),
    commentStore.countByContentIds(contentIds)
  ]);

  const items = result.items.map((item) => {
    const acc = accessMap.get(item.id) || { hasAccess: false, viewerTier: 'free' };
    const rawMedia = mediaMap.get(item.id) || [];
    const signedMedia = mediaService.signMediaList(rawMedia, acc.hasAccess);
    const likeData = likesMap.get(item.id) || { likeCount: 0, likedByMe: false };
    const commentCount = commentsMap.get(item.id) || 0;

    return formatContentItem({
      item: {
        ...item,
        mediaCount: rawMedia.length,
        likeCount: likeData.likeCount,
        likedByMe: likeData.likedByMe,
        commentCount
      },
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

  // Load media items, likes, and comment count in parallel
  const [rawMedia, likeCount, likedByMe, commentCountsMap] = await Promise.all([
    mediaStore.findByContentId(id),
    reactionStore.getLikeCount(id),
    reactionStore.isLikedBy(id, req.user ? req.user.id : null),
    commentStore.countByContentIds([id])
  ]);
  const signedMedia = mediaService.signMediaList(rawMedia, access.hasAccess);
  const commentCount = commentCountsMap.get(id) || 0;

  // Locked item returns 200 with locked: true, body: null, media: [] (preview)
  const formatted = formatContentItem({
    item: {
      ...content,
      mediaCount: rawMedia.length,
      likeCount,
      likedByMe,
      commentCount
    },
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

/**
 * Record a post view (optionalAuth, responds 204 No Content)
 */
const recordView = async (req, res) => {
  const { id } = req.params;
  const ip = req.ip || (req.socket && req.socket.remoteAddress) || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || '';

  const viewService = require('../services/viewService');
  await viewService.recordPostView({
    contentId: id,
    viewer: req.user,
    ip,
    userAgent
  });

  res.status(204).send();
};

/**
 * Like a post (authenticated, full access required)
 */
const likeContent = async (req, res) => {
  const { id } = req.params;
  const likeService = require('../services/likeService');

  const result = await likeService.likePost({
    contentId: id,
    user: req.user
  });

  res.status(200).json(result);
};

/**
 * Unlike a post (authenticated)
 */
const unlikeContent = async (req, res) => {
  const { id } = req.params;
  const likeService = require('../services/likeService');

  const result = await likeService.unlikePost({
    contentId: id,
    user: req.user
  });

  res.status(200).json(result);
};

/**
 * Get trending content leaderboard
 */
const getTrending = async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
  const accessibleOnly = req.query.accessibleOnly === 'true' || req.query.accessibleOnly === true;

  if (isNaN(limit) || limit < 1 || limit > 50) {
    throw ApiError.validation('Query parameter "limit" must be an integer between 1 and 50');
  }

  const trendingService = require('../services/trendingService');
  const result = await trendingService.getTrending({
    viewer: req.user,
    limit,
    accessibleOnly
  });

  res.status(200).json(result);
};

module.exports = {
  createContent,
  listContent,
  getContentById,
  updateContent,
  deleteContent,
  recordView,
  likeContent,
  unlikeContent,
  getTrending
};
