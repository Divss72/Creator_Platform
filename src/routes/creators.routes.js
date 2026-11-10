'use strict';

const { Router } = require('express');
const creatorsController = require('../controllers/creators.controller');
const mediaController = require('../controllers/media.controller');
const analyticsController = require('../controllers/analytics.controller');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { updateProfileSchema } = require('../validators/creators.validator');
const asyncHandler = require('../utils/asyncHandler');
const {
  userWritesLimiter,
  mediaUploadLimiter,
  firebaseTokenLimiter,
  analyticsReadLimiter
} = require('../middleware/rateLimiters');
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

// Mint Firebase custom token for creator live dashboard
router.get(
  '/me/firebase-token',
  requireAuth,
  requireRole('creator'),
  firebaseTokenLimiter,
  asyncHandler(creatorsController.getFirebaseToken)
);

// REST fallback for creator live dashboard
router.get(
  '/me/dashboard/subscribers',
  requireAuth,
  requireRole('creator'),
  asyncHandler(creatorsController.getDashboardSubscribers)
);

// Creator Analytics Overview
router.get(
  '/me/analytics/overview',
  requireAuth,
  requireRole('creator'),
  analyticsReadLimiter,
  asyncHandler(analyticsController.getOverview)
);

// Creator Analytics Timeseries
router.get(
  '/me/analytics/timeseries',
  requireAuth,
  requireRole('creator'),
  analyticsReadLimiter,
  asyncHandler(analyticsController.getTimeseries)
);

// Creator Analytics Top Content
router.get(
  '/me/analytics/top-content',
  requireAuth,
  requireRole('creator'),
  analyticsReadLimiter,
  asyncHandler(analyticsController.getTopContent)
);

// Public creator profile
router.get('/:id', asyncHandler(creatorsController.getCreatorProfile));

module.exports = router;
