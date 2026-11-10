'use strict';

const env = require('../config/env');
const { userStore, subscriptionStore, contentStore, outboxStore } = require('../store');
const { dedupeKeys, buildUnsubscribeUrl } = require('./outboxService');
const { renderDigestEmail } = require('./mail/templates/digest.template');

/**
 * Get ISO week string (e.g. "2026-W45")
 * @param {Date} date
 * @returns {string}
 */
function getIsoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Format a 7-day range ending at now (e.g. "Nov 2 - Nov 9, 2026")
 * @param {Date} now
 * @returns {string}
 */
function formatWeekRange(now) {
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const opts = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString('en-US', opts);
  const endStr = now.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  return `${startStr} - ${endStr}`;
}

/**
 * Run the weekly digest generator.
 *
 * @param {Object} options
 * @param {Date} [options.now=new Date()] Injectable clock for deterministic testing
 * @param {string|null} [options.userId=null] Optional filter for a single user
 * @param {boolean} [options.dryRun=false] If true, simulates run without inserting into outbox
 * @returns {Promise<{ processedUsers: number, enqueuedCount: number, skippedCount: number }>}
 */
async function runDigest({ now = new Date(), userId = null, dryRun = false } = {}) {
  const isoWeek = getIsoWeek(now);
  const weekRange = formatWeekRange(now);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let users = [];
  if (userId) {
    const singleUser = await userStore.findById(userId);
    if (singleUser && singleUser.notifyWeeklyDigest !== false) {
      users = [singleUser];
    }
  } else {
    // Keyset pagination of digest-eligible users
    let afterUserId = null;
    let hasMore = true;
    while (hasMore) {
      const batch = await userStore.findDigestEligibleUsers({ afterUserId, limit: 100 });
      if (batch.length === 0) break;
      users.push(...batch);
      if (batch.length < 100) {
        hasMore = false;
      } else {
        afterUserId = batch[batch.length - 1].id;
      }
    }
  }

  let processedUsers = 0;
  let enqueuedCount = 0;
  let skippedCount = 0;

  for (const user of users) {
    processedUsers++;

    // 1. Find all creators this user has an active subscription to
    const activeSubs = await subscriptionStore.findActiveCreatorsBySubscriber(user.id);
    if (!activeSubs || activeSubs.length === 0) {
      skippedCount++;
      continue;
    }

    const creatorMap = new Map();
    for (const sub of activeSubs) {
      creatorMap.set(sub.creatorId, sub);
    }

    // 2. Query posts published in the last 7 days by these creators
    const creatorIds = Array.from(creatorMap.keys());
    const recentPosts = await contentStore.findRecentPostsByCreators({
      creatorIds,
      since: sevenDaysAgo,
      limit: 100
    });

    if (!recentPosts || recentPosts.length === 0) {
      skippedCount++;
      continue;
    }

    // 3. Filter posts by subscriber's tier rank for that creator
    const eligiblePostsByCreator = new Map();
    let totalEligiblePosts = 0;

    for (const post of recentPosts) {
      if (totalEligiblePosts >= env.DIGEST_MAX_POSTS) {
        break;
      }

      const sub = creatorMap.get(post.creatorId);
      if (!sub) continue;

      if (sub.tierRank >= post.minTierRank) {
        if (!eligiblePostsByCreator.has(post.creatorId)) {
          eligiblePostsByCreator.set(post.creatorId, {
            creatorName: sub.creatorName,
            posts: []
          });
        }

        eligiblePostsByCreator.get(post.creatorId).posts.push({
          title: post.title,
          url: `${env.APP_BASE_URL}/content/${post.id}`,
          minTier: post.minTier
        });

        totalEligiblePosts++;
      }
    }

    if (totalEligiblePosts === 0) {
      skippedCount++;
      continue;
    }

    const creatorsWithPosts = Array.from(eligiblePostsByCreator.values());
    const unsubscribeUrl = buildUnsubscribeUrl({ userId: user.id, type: 'weekly_digest' });

    const rendered = renderDigestEmail({
      subscriberName: user.name,
      weekRange,
      creatorsWithPosts,
      unsubscribeUrl
    });

    const dedupeKey = dedupeKeys.digest(user.id, isoWeek);

    if (dryRun) {
      console.log(
        `[DigestService:DryRun] Would enqueue digest for ${user.email} (dedupeKey: ${dedupeKey}, posts: ${totalEligiblePosts})`
      );
      enqueuedCount++;
    } else {
      const res = await outboxStore.enqueue({
        type: 'weekly_digest',
        userId: user.id,
        toEmail: user.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        dedupeKey,
        meta: {
          isoWeek,
          postCount: totalEligiblePosts
        }
      });

      if (res.enqueued) {
        enqueuedCount++;
      } else {
        skippedCount++;
      }
    }
  }

  return {
    processedUsers,
    enqueuedCount,
    skippedCount
  };
}

module.exports = {
  getIsoWeek,
  formatWeekRange,
  runDigest
};
