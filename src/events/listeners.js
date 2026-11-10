'use strict';

const { domainEvents, DOMAIN_EVENTS, trackTask } = require('./domainEvents');

let registered = false;

/**
 * Register all domain event listeners.
 * Side-effect isolation: each listener is wrapped in try/catch and never throws uncaught errors.
 */
function registerDomainListeners() {
  if (registered) return;
  registered = true;

  domainEvents.on(DOMAIN_EVENTS.SUBSCRIPTION_CHANGED, (payload) => {
    const task = Promise.resolve().then(async () => {
      try {
        const { subscriberId, creatorId, action, tier } = payload;

        // 1. Welcome email on initial creation or re-activation
        if (action === 'created' || action === 'reactivated') {
          try {
            const notificationService = require('../services/notificationService');
            await notificationService.enqueueWelcomeEmail({ subscriberId, creatorId, tier });
          } catch (err) {
            console.error('[DomainListener] Failed to enqueue welcome email:', err.message);
          }
        }

        // 2. Mirror live subscriber metrics to Firebase
        try {
          const firebaseSyncService = require('../services/firebaseSyncService');
          await firebaseSyncService.syncCreatorMetrics(creatorId);
        } catch (err) {
          console.error('[DomainListener] Failed to sync Firebase metrics:', err.message);
        }
      } catch (err) {
        console.error('[DomainListener] Error in subscription.changed handler:', err.message);
      }
    });

    trackTask(task);
  });

  domainEvents.on(DOMAIN_EVENTS.CONTENT_CREATED, (payload) => {
    const task = Promise.resolve().then(async () => {
      try {
        const notificationService = require('../services/notificationService');
        await notificationService.enqueueNewPostEmails(payload);
      } catch (err) {
        console.error('[DomainListener] Failed to enqueue new post emails:', err.message);
      }
    });

    trackTask(task);
  });
}

module.exports = {
  registerDomainListeners
};
