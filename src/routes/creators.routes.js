const { Router } = require('express');
const creatorsController = require('../controllers/creators.controller');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { updateProfileSchema } = require('../validators/creators.validator');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

// Update authenticated creator profile (must be defined before /:id)
router.put('/me', requireAuth, requireRole('creator'), validate(updateProfileSchema), asyncHandler(creatorsController.updateMyProfile));

// Public creator profile
router.get('/:id', asyncHandler(creatorsController.getCreatorProfile));

module.exports = router;
