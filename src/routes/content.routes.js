const { Router } = require('express');
const contentController = require('../controllers/content.controller');
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
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

// List all content (paginated, optional authentication for paywall access)
router.get('/', optionalAuth, validate(listContentSchema), asyncHandler(contentController.listContent));

// Get single content item (optional authentication for preview vs full content)
router.get('/:id', optionalAuth, validate(contentIdParamSchema), asyncHandler(contentController.getContentById));

// Create content (creator only)
router.post(
  '/',
  requireAuth,
  requireRole('creator'),
  validate(createContentSchema),
  asyncHandler(contentController.createContent)
);

// Update content (creator owner only)
router.put(
  '/:id',
  requireAuth,
  requireRole('creator'),
  validate(updateContentSchema),
  asyncHandler(contentController.updateContent)
);

// Delete content (creator owner only)
router.delete(
  '/:id',
  requireAuth,
  requireRole('creator'),
  validate(contentIdParamSchema),
  asyncHandler(contentController.deleteContent)
);

module.exports = router;
