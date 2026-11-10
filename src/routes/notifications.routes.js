'use strict';

const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const asyncHandler = require('../utils/asyncHandler');
const notificationsController = require('../controllers/notifications.controller');

const router = express.Router();

router.get('/preferences', requireAuth, asyncHandler(notificationsController.getPreferences));
router.put('/preferences', requireAuth, asyncHandler(notificationsController.updatePreferences));

module.exports = router;
