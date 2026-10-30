const contentStore = require('../store/contentStore');
const commentStore = require('../store/commentStore');
const accessService = require('./accessService');
const ApiError = require('../utils/apiError');

/**
 * Service handling comment business logic across REST, Socket.io, and future GraphQL.
 * Contains NO Express or Socket.io objects.
 */

// TODO(future): Deleting or moderating comments is out of scope.

/**
 * Create a new comment on a post after validating body and checking live access rules.
 *
 * @param {Object} params
 * @param {Object|null} params.viewer - Authenticated user object or null
 * @param {string} params.contentId - Content ID
 * @param {string} params.body - Comment body text
 * @returns {Promise<Object>} Created comment object
 */
const createComment = async ({ viewer, contentId, body }) => {
  // 1. Authentication check
  if (!viewer || !viewer.id) {
    throw ApiError.unauthorized('Authentication required to comment', 'UNAUTHENTICATED');
  }

  // 2. Validate contentId
  if (!contentId || typeof contentId !== 'string') {
    throw ApiError.validation('Valid contentId is required');
  }

  // 3. Validate body (1 to 1000 characters, trimmed, non-whitespace-only)
  if (typeof body !== 'string') {
    throw ApiError.validation('Comment body must be a string');
  }

  const trimmedBody = body.trim();
  if (trimmedBody.length < 1 || trimmedBody.length > 1000) {
    throw ApiError.validation('Comment body must be between 1 and 1000 characters');
  }

  // 4. Load fresh content from DB
  const content = await contentStore.findById(contentId);
  if (!content) {
    throw ApiError.notFound('Content not found');
  }

  // 5. Access control check via accessService (owners have access, subscribers follow tier rules)
  const access = await accessService.resolveAccess({ viewer, content });
  if (!access.hasAccess) {
    throw ApiError.tierRequired('Higher tier subscription required to comment on this content', {
      requiredTier: access.requiredTier,
      viewerTier: access.viewerTier
    });
  }

  // TODO(v0.6): sanitisation and moderation. Clients must never render it as HTML.
  // Stored and sent as PLAIN TEXT.
  const comment = await commentStore.create({
    contentId,
    userId: viewer.id,
    body: trimmedBody
  });

  return comment;
};

/**
 * List comments on a post using cursor pagination after checking live access rules.
 *
 * @param {Object} params
 * @param {Object|null} params.viewer - Authenticated user object or null
 * @param {string} params.contentId - Content ID
 * @param {number} [params.limit=50] - Number of comments to return (max 100)
 * @param {string|null} [params.before=null] - Cursor (comment ID) for older comments
 * @returns {Promise<{ items: Array, nextBefore: string|null }>}
 */
const listComments = async ({ viewer, contentId, limit = 50, before = null }) => {
  if (!contentId || typeof contentId !== 'string') {
    throw ApiError.validation('Valid contentId is required');
  }

  // 1. Load content
  const content = await contentStore.findById(contentId);
  if (!content) {
    throw ApiError.notFound('Content not found');
  }

  // 2. Access control check (applies the exact same paywall rules as the content)
  const access = await accessService.resolveAccess({ viewer, content });
  if (!access.hasAccess) {
    throw ApiError.tierRequired('Higher tier subscription required to view comments', {
      requiredTier: access.requiredTier,
      viewerTier: access.viewerTier
    });
  }

  // 3. Retrieve paginated comments via store cursor
  const result = await commentStore.listByContentWithCursor({
    contentId,
    limit,
    before
  });

  return result;
};

module.exports = {
  createComment,
  listComments
};
