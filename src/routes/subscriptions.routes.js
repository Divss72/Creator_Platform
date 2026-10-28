const { Router } = require('express');
const subscriptionsController = require('../controllers/subscriptions.controller');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const {
  subscribeSchema,
  creatorIdParamSchema
} = require('../validators/subscriptions.validator');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

// All subscription operations require an authenticated subscriber
router.use(requireAuth, requireRole('subscriber'));

// List my subscriptions
router.get('/me', asyncHandler(subscriptionsController.getMySubscriptions));

// Subscribe / upgrade / downgrade / reactivate
router.post('/', validate(subscribeSchema), asyncHandler(subscriptionsController.subscribe));

// Cancel subscription to a specific creator
router.delete('/:creatorId', validate(creatorIdParamSchema), asyncHandler(subscriptionsController.cancelSubscription));

module.exports = router;
