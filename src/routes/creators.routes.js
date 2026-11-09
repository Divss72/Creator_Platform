'use strict';

const { Router } = require('express');
const creatorsController = require('../controllers/creators.controller');
const mediaController = require('../controllers/media.controller');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { updateProfileSchema } = require('../validators/creators.validator');
const asyncHandler = require('../utils/asyncHandler');
const { userWritesLimiter, mediaUploadLimiter } = require('../middleware/rateLimiters');
const { avatarUpload } = require('../middleware/upload');

const router = Router();

// Update authenticated creator profile (must be defined before /:id)
router.put(
  '/me',
  requireAuth,
  requireRole('creator'),
  userWritesLimiter,
  validate(updateProfileSchema),
  asyncHandler(creatorsController.updateMyProfile)
);

// Upload creator avatar
router.put(
  '/me/avatar',
  requireAuth,
  requireRole('creator'),
  mediaUploadLimiter,
  avatarUpload,
  asyncHandler(mediaController.uploadAvatar)
);

// Public creator profile
router.get('/:id', asyncHandler(creatorsController.getCreatorProfile));

module.exports = router;
