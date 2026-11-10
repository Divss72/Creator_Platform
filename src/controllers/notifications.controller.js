'use strict';

const { userStore } = require('../store');
const ApiError = require('../utils/apiError');

/**
 * Get notification preferences for authenticated user
 * GET /api/notifications/preferences
 */
const getPreferences = async (req, res) => {
  const user = await userStore.findById(req.user.id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  res.status(200).json({
    preferences: {
      notifyNewPosts: user.notifyNewPosts !== undefined ? user.notifyNewPosts : true,
      notifyWeeklyDigest: user.notifyWeeklyDigest !== undefined ? user.notifyWeeklyDigest : true
    }
  });
};

/**
 * Update notification preferences for authenticated user
 * PUT /api/notifications/preferences
 */
const updatePreferences = async (req, res) => {
  const { notifyNewPosts, notifyWeeklyDigest } = req.body;

  if (notifyNewPosts === undefined && notifyWeeklyDigest === undefined) {
    throw ApiError.badRequest('At least one of notifyNewPosts or notifyWeeklyDigest must be provided');
  }

  if (notifyNewPosts !== undefined && typeof notifyNewPosts !== 'boolean') {
    throw ApiError.badRequest('notifyNewPosts must be a boolean');
  }

  if (notifyWeeklyDigest !== undefined && typeof notifyWeeklyDigest !== 'boolean') {
    throw ApiError.badRequest('notifyWeeklyDigest must be a boolean');
  }

  const updated = await userStore.updateNotificationPreferences(req.user.id, {
    notifyNewPosts,
    notifyWeeklyDigest
  });

  if (!updated) {
    throw ApiError.notFound('User not found');
  }

  res.status(200).json({
    message: 'Notification preferences updated successfully',
    preferences: updated
  });
};

module.exports = {
  getPreferences,
  updatePreferences
};

