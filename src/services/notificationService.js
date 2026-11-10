'use strict';

const env = require('../config/env');
const { userStore, tierStore, outboxStore } = require('../store');
const accessService = require('./accessService');
const { dedupeKeys, buildUnsubscribeUrl } = require('./outboxService');
const { renderWelcomeEmail } = require('./mail/templates/welcome.template');
const { renderNewPostEmail } = require('./mail/templates/newPost.template');

/**
 * Enqueue a welcome email for a newly created or reactivated subscription.
 *
 * @param {Object} params
 * @param {string} params.subscriberId
 * @param {string} params.creatorId
 * @param {string} params.tier
 */
async function enqueueWelcomeEmail({ subscriberId, creatorId, tier }) {
  try {
    const subscriber = await userStore.findById(subscriberId);
    const creator = await userStore.findById(creatorId);

    if (!subscriber || !creator) {
      return;
    }

    const creatorName = creator.displayName || creator.name;
    const unsubscribeUrl = buildUnsubscribeUrl({ userId: subscriber.id, type: 'all' });

    const rendered = renderWelcomeEmail({
      subscriberName: subscriber.name,
      creatorName,
      tierName: tier,
      unsubscribeUrl
    });

    const dedupeKey = dedupeKeys.welcome(subscriber.id, creator.id, tier);

    await outboxStore.enqueue({
      type: 'welcome',
      userId: subscriber.id,
      toEmail: subscriber.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      dedupeKey,
      meta: {
        creatorId: creator.id,
        tier
      }
    });
  } catch (err) {
    console.error('[NotificationService] Error enqueuing welcome email:', err.message);
  }
}

/**
 * Enqueue new post notification emails to all eligible subscribers.
 * Paged keyset fan-out loop to safely handle thousands of subscribers without memory pressure.
 *
 * @param {Object} content
 */
async function enqueueNewPostEmails(content) {
  try {
    const contentId = content?.id || content?.contentId;
    if (!content || !contentId || !content.creatorId) {
      return;
    }

    const creator = await userStore.findById(content.creatorId);
    if (!creator) return;

    const creatorName = creator.displayName || creator.name;
    const tierName = content.minTier || 'free';
    const tierRecord = await tierStore.getByName(tierName);
    const minTierRank = tierRecord ? tierRecord.rank : 0;

    const postUrl = `${env.APP_BASE_URL}/content/${contentId}`;

    let afterUserId = null;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      const eligibleSubscribers = await accessService.getEligibleSubscribers({
        creatorId: content.creatorId,
        requiredRank: minTierRank,
        afterUserId,
        limit: pageSize
      });

      if (eligibleSubscribers.length === 0) {
        break;
      }

      for (const sub of eligibleSubscribers) {
        const unsubscribeUrl = buildUnsubscribeUrl({ userId: sub.userId, type: 'new_posts' });
        const rendered = renderNewPostEmail({
          subscriberName: sub.name,
          creatorName,
          postTitle: content.title,
          postExcerpt: content.excerpt || '',
          postUrl,
          unsubscribeUrl
        });

        const dedupeKey = dedupeKeys.newPost(sub.userId, contentId);

        await outboxStore.enqueue({
          type: 'new_post',
          userId: sub.userId,
          toEmail: sub.email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          dedupeKey,
          meta: {
            creatorId: content.creatorId,
            contentId,
            minTierRank
          }
        });
      }

      if (eligibleSubscribers.length < pageSize) {
        hasMore = false;
      } else {
        afterUserId = eligibleSubscribers[eligibleSubscribers.length - 1].userId;
      }
    }
  } catch (err) {
    console.error('[NotificationService] Error enqueuing new post emails:', err.message);
  }
}

module.exports = {
  enqueueWelcomeEmail,
  enqueueNewPostEmails
};
