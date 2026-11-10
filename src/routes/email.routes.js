'use strict';

const express = require('express');
const { unsubscribeLimiter } = require('../middleware/rateLimiters');
const asyncHandler = require('../utils/asyncHandler');
const emailController = require('../controllers/email.controller');

const router = express.Router();

router.get('/unsubscribe', unsubscribeLimiter, asyncHandler(emailController.unsubscribe));
router.post('/unsubscribe', unsubscribeLimiter, asyncHandler(emailController.unsubscribe));

module.exports = router;
