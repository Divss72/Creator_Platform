const { userStore, subscriptionStore, tierStore } = require('../store');
const mockPaymentService = require('../services/mockPaymentService');
const ApiError = require('../utils/apiError');
const realtimeEvents = require('../realtime/events');
const { emitSubscriptionChanged } = require('../events/domainEvents');

/**
 * Subscribe, upgrade, downgrade, or reactivate subscription (Subscriber only)
 */
const subscribe = async (req, res) => {
  // A creator trying to subscribe -> 403
  if (req.user.role === 'creator') {
    throw ApiError.forbidden('Creators cannot subscribe to creators');
  }

  const { creatorId, tier } = req.body;

  // Unknown creatorId or user who is not a creator -> 404
  const creatorUser = await userStore.findById(creatorId);
  if (!creatorUser || creatorUser.role !== 'creator') {
    throw ApiError.notFound('Creator not found');
  }

  // Verify tier exists
  const tierRecord = await tierStore.getByName(tier);
  if (!tierRecord) {
    throw ApiError.badRequest(`Invalid tier '${tier}'`);
  }

  // Simulated payment transaction (always succeeds in mock mode)
  await mockPaymentService.processPayment({
    subscriberId: req.user.id,
    creatorId,
    tier,
    priceCents: tierRecord.priceCents
  });

  // Execute subscription upsert in store
  const result = await subscriptionStore.subscribe({
    subscriberId: req.user.id,
    creatorId,
    tierName: tier
  });

  // Notify realtime layer to revalidate active socket rooms for this creator
  try {
    await realtimeEvents.onSubscriptionChanged({
      userId: req.user.id,
      creatorId
    });
  } catch (err) {
    console.error('[Subscriptions Controller] Realtime notification error:', err.message);
  }

  // Emit domain event for side effects (welcome email, live Firebase count)
  emitSubscriptionChanged({
    subscriberId: req.user.id,
    creatorId,
    action: result.action || (result.isNew ? 'created' : 'upgraded'),
    tier,
    previousTier: result.previousTier || null
  });

  res.status(result.statusCode).json({
    subscription: result.subscription
  });
};

/**
 * List all subscriptions for the authenticated subscriber
 */
const getMySubscriptions = async (req, res) => {
  const subscriptions = await subscriptionStore.listBySubscriber(req.user.id);

  res.status(200).json({
    subscriptions
  });
};

/**
 * Cancel subscription to a specific creator (Subscriber only)
 */
const cancelSubscription = async (req, res) => {
  const { creatorId } = req.params;

  const cancelled = await subscriptionStore.cancel({
    subscriberId: req.user.id,
    creatorId
  });

  if (!cancelled) {
    throw ApiError.notFound('No subscription found for this creator');
  }

  // Notify realtime layer to revalidate active socket rooms for this creator
  try {
    await realtimeEvents.onSubscriptionChanged({
      userId: req.user.id,
      creatorId
    });
  } catch (err) {
    console.error('[Subscriptions Controller] Realtime notification error:', err.message);
  }

  // Emit domain event for side effects (Firebase count update)
  emitSubscriptionChanged({
    subscriberId: req.user.id,
    creatorId,
    action: 'cancelled',
    tier: cancelled.tier,
    previousTier: cancelled.tier
  });

  res.status(200).json({
    message: 'Subscription cancelled successfully',
    subscription: cancelled
  });
};

module.exports = {
  subscribe,
  getMySubscriptions,
  cancelSubscription
};
