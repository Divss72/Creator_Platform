'use strict';

const crypto = require('crypto');
const { hashPassword } = require('../../src/utils/password');
const { generateToken } = require('../../src/utils/jwt');
const { userStore, contentStore, subscriptionStore, tierStore } = require('../../src/store');

let counter = 0;
function uniqueSuffix() {
  counter++;
  return `${Date.now()}_${counter}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Factory for creating a Creator user and profile in the database.
 */
async function createCreator(overrides = {}) {
  const suffix = uniqueSuffix();
  const password = overrides.password || 'Password123!';
  const passwordHash = await hashPassword(password);

  const user = await userStore.create({
    name: overrides.name || `Creator_${suffix}`,
    email: overrides.email || `creator_${suffix}@test.local`,
    passwordHash,
    role: 'creator',
    displayName: overrides.displayName || `Creator ${suffix}`,
    bio: overrides.bio || 'Test creator bio'
  });

  const token = generateToken({ sub: user.id, role: 'creator' });
  return { ...user, rawPassword: password, token };
}

/**
 * Factory for creating a Subscriber user in the database.
 */
async function createSubscriber(overrides = {}) {
  const suffix = uniqueSuffix();
  const password = overrides.password || 'Password123!';
  const passwordHash = await hashPassword(password);

  const user = await userStore.create({
    name: overrides.name || `Subscriber_${suffix}`,
    email: overrides.email || `sub_${suffix}@test.local`,
    passwordHash,
    role: 'subscriber'
  });

  if (overrides.notifyNewPosts !== undefined || overrides.notifyWeeklyDigest !== undefined) {
    await userStore.updateNotificationPreferences(user.id, {
      notifyNewPosts: overrides.notifyNewPosts,
      notifyWeeklyDigest: overrides.notifyWeeklyDigest
    });
    user.notifyNewPosts = overrides.notifyNewPosts ?? true;
    user.notifyWeeklyDigest = overrides.notifyWeeklyDigest ?? true;
  }

  const token = generateToken({ sub: user.id, role: 'subscriber' });
  return { ...user, rawPassword: password, token };
}

/**
 * Factory for creating a Content item in the database.
 */
async function createPost(overrides = {}) {
  const creatorId = overrides.creatorId;
  if (!creatorId) {
    throw new Error('createPost requires creatorId');
  }

  const minTierName = overrides.minTier || 'free';
  const tier = await tierStore.getByName(minTierName);
  if (!tier) {
    throw new Error(`Tier not found: ${minTierName}`);
  }

  const suffix = uniqueSuffix();
  const post = await contentStore.create({
    creatorId,
    title: overrides.title || `Post Title ${suffix}`,
    body: overrides.body || `<p>Post body content ${suffix}</p>`,
    minTier: minTierName
  });

  return post;
}

/**
 * Factory for creating a Subscription between a subscriber and creator.
 */
async function createSubscription(overrides = {}) {
  const { subscriberId, creatorId, tier: tierName = 'free', status = 'active' } = overrides;

  if (!subscriberId || !creatorId) {
    throw new Error('createSubscription requires subscriberId and creatorId');
  }

  const res = await subscriptionStore.subscribe({
    subscriberId,
    creatorId,
    tierName
  });

  if (status === 'cancelled') {
    await subscriptionStore.cancel({ subscriberId, creatorId });
    return subscriptionStore.findBySubscriberAndCreator(subscriberId, creatorId);
  }

  return res.subscription;
}

module.exports = {
  createCreator,
  createSubscriber,
  createPost,
  createSubscription,
  uniqueSuffix
};
