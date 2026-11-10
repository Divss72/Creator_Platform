'use strict';

const EventEmitter = require('events');

class DomainEventEmitter extends EventEmitter {}

const domainEvents = new DomainEventEmitter();

// Limit warning threshold to prevent listener leaks in complex test runs
domainEvents.setMaxListeners(50);

const DOMAIN_EVENTS = {
  SUBSCRIPTION_CHANGED: 'subscription.changed',
  CONTENT_CREATED: 'content.created'
};

/**
 * Emit a subscription lifecycle event.
 * @param {Object} payload
 * @param {string} payload.subscriberId
 * @param {string} payload.creatorId
 * @param {'created'|'upgraded'|'downgraded'|'reactivated'|'cancelled'} payload.action
 * @param {string} payload.tier
 * @param {string|null} [payload.previousTier]
 */
const emitSubscriptionChanged = (payload) => {
  try {
    domainEvents.emit(DOMAIN_EVENTS.SUBSCRIPTION_CHANGED, payload);
  } catch (err) {
    console.error('[DomainEvents] Error emitting subscription.changed:', err.message);
  }
};

/**
 * Emit a content creation event.
 * @param {Object} payload
 * @param {string} payload.contentId
 * @param {string} payload.creatorId
 * @param {string} payload.title
 * @param {string} payload.minTier
 * @param {Date|string} [payload.publishedAt]
 */
const emitContentCreated = (payload) => {
  try {
    domainEvents.emit(DOMAIN_EVENTS.CONTENT_CREATED, payload);
  } catch (err) {
    console.error('[DomainEvents] Error emitting content.created:', err.message);
  }
};

const activeTasks = new Set();

/**
 * Register a promise in the domain event task tracker.
 * @param {Promise<any>} promise
 * @returns {Promise<any>}
 */
const trackTask = (promise) => {
  activeTasks.add(promise);
  promise.finally(() => {
    activeTasks.delete(promise);
  });
  return promise;
};

/**
 * Wait until all in-flight domain event asynchronous handler tasks have settled.
 * Eliminates arbitrary sleeps in integration tests.
 * @returns {Promise<void>}
 */
const whenIdle = async () => {
  while (activeTasks.size > 0) {
    await Promise.all(Array.from(activeTasks));
  }
};

module.exports = {
  domainEvents,
  DOMAIN_EVENTS,
  emitSubscriptionChanged,
  emitContentCreated,
  trackTask,
  whenIdle
};
