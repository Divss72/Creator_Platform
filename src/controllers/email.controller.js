'use strict';

const { userStore } = require('../store');
const { verifyUnsubscribeToken } = require('../services/outboxService');
const ApiError = require('../utils/apiError');

/**
 * Handle unsubscribe requests (both GET for browser clicks and POST for RFC 8058 one-click).
 * GET /api/email/unsubscribe?token=...
 * POST /api/email/unsubscribe?token=...
 */
const unsubscribe = async (req, res) => {
  const token = req.query.token || req.body?.token;

  if (!token) {
    throw ApiError.badRequest('Missing unsubscribe token');
  }

  const result = verifyUnsubscribeToken(token);
  if (!result.valid) {
    if (result.expired) {
      throw ApiError.badRequest('Unsubscribe token has expired. Please update preferences in account settings.');
    }
    throw ApiError.badRequest('Invalid unsubscribe token');
  }

  const { userId, type } = result;

  const updates = {};
  if (type === 'new_posts') {
    updates.notifyNewPosts = false;
  } else if (type === 'weekly_digest') {
    updates.notifyWeeklyDigest = false;
  } else {
    // 'all' or default
    updates.notifyNewPosts = false;
    updates.notifyWeeklyDigest = false;
  }

  const updatedPrefs = await userStore.updateNotificationPreferences(userId, updates);
  if (!updatedPrefs) {
    throw ApiError.notFound('User not found');
  }

  if (req.method === 'GET' && req.accepts('html') && !req.accepts('json')) {
    return res.status(200).send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Unsubscribed - CreatorHub</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 40px auto; max-width: 500px; padding: 20px; text-align: center; }
    .card { border: 1px solid #e1e4e8; border-radius: 8px; padding: 32px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    h2 { color: #1f883d; margin-top: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h2>✓ Unsubscribed Successfully</h2>
    <p>You will no longer receive ${type === 'all' ? 'marketing and notification' : type.replace('_', ' ')} emails from CreatorHub.</p>
  </div>
</body>
</html>`);
  }

  return res.status(200).json({
    message: 'Unsubscribed successfully',
    preferences: updatedPrefs
  });
};

module.exports = {
  unsubscribe
};

