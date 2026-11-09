'use strict';

const { Router } = require('express');
const contentController = require('../controllers/content.controller');
const mediaController = require('../controllers/media.controller');
const requireAuth = require('../middleware/requireAuth');
const optionalAuth = require('../middleware/optionalAuth');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const {
  createContentSchema,
  updateContentSchema,
  listContentSchema,
  contentIdParamSchema
} = require('../validators/content.validator');
const commentsController = require('../controllers/comments.controller');
const { listCommentsSchema } = require('../validators/comments.validator');
const asyncHandler = require('../utils/asyncHandler');
const { userWritesLimiter, mediaUploadLimiter } = require('../middleware/rateLimiters');
const { mediaUpload } = require('../middleware/upload');
const { contentStore } = require('../store');
const ApiError = require('../utils/apiError');

const router = Router();

// Middleware: ownership check BEFORE multer parses the body
const checkPostOwnership = async (req, res, next) => {
  const content = await contentStore.findById(req.params.id);
  if (!content) {
    return next(ApiError.notFound('Content not found'));
  }
  if (content.creatorId !== req.user.id) {
    return next(ApiError.forbidden('You can only attach media to posts you authored'));
  }
  next();
};

// List all content (paginated, optional authentication for paywall access)
router.get('/', optionalAuth, validate(listContentSchema), asyncHandler(contentController.listContent));

// List comments for a post (chat history, optional authentication for paywall access)
router.get('/:id/comments', optionalAuth, validate(listCommentsSchema), asyncHandler(commentsController.listComments));

// Get single content item (optional authentication for preview vs full content)
router.get('/:id', optionalAuth, validate(contentIdParamSchema), asyncHandler(contentController.getContentById));

// Create content (creator only)
router.post(
  '/',
  requireAuth,
  requireRole('creator'),
  userWritesLimiter,
  validate(createContentSchema),
  asyncHandler(contentController.createContent)
);

// Update content (creator owner only)
router.put(
  '/:id',
  requireAuth,
  requireRole('creator'),
  userWritesLimiter,
  validate(updateContentSchema),
  asyncHandler(contentController.updateContent)
);

// Delete content (creator owner only)
router.delete(
  '/:id',
  requireAuth,
  requireRole('creator'),
  userWritesLimiter,
  validate(contentIdParamSchema),
  asyncHandler(contentController.deleteContent)
);

// Upload post media (Creator owner only)
// Pipeline order: requireAuth, role check, rate limit, ownership check run BEFORE multer
router.post(
  '/:id/media',
  requireAuth,
  requireRole('creator'),
  mediaUploadLimiter,
  validate(contentIdParamSchema),
  checkPostOwnership,
  mediaUpload,
  asyncHandler(mediaController.uploadMedia)
);

// Delete post media (Creator owner only)
router.delete(
  '/:id/media/:mediaId',
  requireAuth,
  requireRole('creator'),
  userWritesLimiter,
  asyncHandler(mediaController.deleteMedia)
);

module.exports = router;
