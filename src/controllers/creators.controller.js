'use strict';

const env = require('../config/env');
const { userStore, subscriptionStore } = require('../store');
const { getFirebaseDriver } = require('../services/firebase');
const ApiError = require('../utils/apiError');

/**
 * Get public creator profile by ID
 */
const getCreatorProfile = async (req, res) => {
  const { id } = req.params;
  const user = await userStore.findById(id);

  if (!user || user.role !== 'creator') {
    throw ApiError.notFound('Creator not found');
  }

  res.status(200).json({
    creator: {
      id: user.id,
      name: user.name,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl || null,
      createdAt: user.createdAt
    }
  });
};

/**
 * Update authenticated creator's profile
 */
const updateMyProfile = async (req, res) => {
  const { displayName, bio } = req.body;

  const updatedUser = await userStore.update(req.user.id, {
    displayName,
    bio
  });

  if (!updatedUser) {
    throw ApiError.notFound('Creator profile could not be found');
  }

  res.status(200).json({
    creator: {
      id: updatedUser.id,
      name: updatedUser.name,
      displayName: updatedUser.displayName,
      bio: updatedUser.bio,
      avatarUrl: updatedUser.avatarUrl || null,
      updatedAt: updatedUser.updatedAt
    }
  });
};

/**
 * Mint a Firebase custom auth token for the authenticated creator
 * GET /api/creators/me/firebase-token
 */
const getFirebaseToken = async (req, res) => {
  if (req.user.role !== 'creator') {
    throw ApiError.forbidden('Only creators can access realtime dashboard tokens');
  }

  const driver = getFirebaseDriver();
  const token = await driver.createCustomToken(req.user.id, { role: 'creator' });

  res.status(200).json({
    token,
    databaseUrl: env.FIREBASE_DATABASE_URL,
    path: `creatorStats/${req.user.id}`
  });
};

/**
 * REST fallback: Get live subscriber metrics directly from MySQL
 * GET /api/creators/me/dashboard/subscribers
 */
const getDashboardSubscribers = async (req, res) => {
  if (req.user.role !== 'creator') {
    throw ApiError.forbidden('Only creators can view subscriber metrics');
  }

  const metrics = await subscriptionStore.countActiveByCreatorGroupedByTier(req.user.id);

  res.status(200).json({
    subscriberCount: metrics.total,
    byTier: metrics.byTier,
    updatedAt: new Date().toISOString()
  });
};

module.exports = {
  getCreatorProfile,
  updateMyProfile,
  getFirebaseToken,
  getDashboardSubscribers
};
