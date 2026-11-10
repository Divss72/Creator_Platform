'use strict';

const crypto = require('crypto');
const env = require('../config/env');
const { outboxStore, userStore } = require('../store');
const accessService = require('./accessService');
const { getMailDriver } = require('./mail');

/**
 * Generate HMAC-SHA256 signature for unsubscribe token.
 */
function signToken(data) {
  return crypto.createHmac('sha256', env.EMAIL_TOKEN_SECRET).update(data).digest('base64url');
}

/**
 * Deduplication key generators
 */
const dedupeKeys = {
  welcome: (subscriberId, creatorId, tier) => `welcome:${subscriberId}:${creatorId}:${tier}`,
  newPost: (subscriberId, contentId) => `post:${subscriberId}:${contentId}`,
  digest: (subscriberId, isoWeek) => `digest:${subscriberId}:${isoWeek}`
};

/**
 * Create a signed, tamper-proof unsubscribe token.
 * Format: base64url(userId.type.expiresAt.signature)
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {'all'|'new_posts'|'weekly_digest'} [params.type='all']
 * @param {number} [params.expiresInDays=30]
 * @returns {string}
 */
function createUnsubscribeToken({ userId, type = 'all', expiresInDays = 30 }) {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60;
  const payload = `${userId}.${type}.${expiresAt}`;
  const sig = signToken(payload);
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

/**
 * Verify an unsubscribe token.
 *
 * @param {string} token
 * @returns {{ valid: boolean, userId?: string, type?: string, expired?: boolean }}
 */
function verifyUnsubscribeToken(token) {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false };
    }

    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split('.');
    if (parts.length !== 4) {
      return { valid: false };
    }

    const [userId, type, rawExpiresAt, sig] = parts;
    const expiresAt = parseInt(rawExpiresAt, 10);
    if (!userId || !type || Number.isNaN(expiresAt)) {
      return { valid: false };
    }

    // Verify signature with timing-safe comparison
    const expectedSig = signToken(`${userId}.${type}.${rawExpiresAt}`);
    const sigBuffer = Buffer.from(sig);
    const expectedBuffer = Buffer.from(expectedSig);

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      return { valid: false };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > expiresAt) {
      return { valid: false, expired: true, userId, type };
    }

    return { valid: true, expired: false, userId, type };
  } catch (err) {
    return { valid: false };
  }
}

/**
 * Build canonical unsubscribe URL.
 */
function buildUnsubscribeUrl({ userId, type = 'all', expiresInDays = 30 }) {
  const token = createUnsubscribeToken({ userId, type, expiresInDays });
  return `${env.APP_BASE_URL}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Calculate next attempt time using configured retry delays.
 * @param {number} attempt
 * @returns {Date}
 */
function calculateNextAttempt(attempt) {
  const delays = env.EMAIL_RETRY_DELAYS_SECONDS;
  const delaySec = delays[Math.min(attempt, delays.length - 1)] || 3600;
  return new Date(Date.now() + delaySec * 1000);
}

/**
 * Process a single outbox row.
 * Enforces send-time eligibility re-checks:
 * 1. Daily recipient cap check
 * 2. User notification preferences check
 * 3. Fresh subscription access check for new-post emails
 *
 * @param {Object} row
 * @returns {Promise<{ status: 'sent'|'skipped'|'failed', error?: string }>}
 */
async function processOutboxRow(row) {
  try {
    // 1. Abuse protection: Check 24h recipient cap
    const sentCount24h = await outboxStore.countByRecipientLast24h(row.toEmail);
    if (sentCount24h >= env.EMAIL_MAX_PER_RECIPIENT_PER_DAY) {
      await outboxStore.markSkipped(row.id, { reason: 'daily_cap_exceeded' });
      return { status: 'skipped', error: 'daily_cap_exceeded' };
    }

    // 2. Fresh User & Preferences check
    const user = await userStore.findById(row.userId);
    if (!user) {
      await outboxStore.markSkipped(row.id, { reason: 'user_not_found' });
      return { status: 'skipped', error: 'user_not_found' };
    }

    if (row.type === 'new_post' && user.notifyNewPosts === false) {
      await outboxStore.markSkipped(row.id, { reason: 'unsubscribed_new_posts' });
      return { status: 'skipped', error: 'unsubscribed_new_posts' };
    }

    if (row.type === 'weekly_digest' && user.notifyWeeklyDigest === false) {
      await outboxStore.markSkipped(row.id, { reason: 'unsubscribed_weekly_digest' });
      return { status: 'skipped', error: 'unsubscribed_weekly_digest' };
    }

    // 3. Send-time access re-check for new_post
    if (row.type === 'new_post' && row.meta && row.meta.creatorId) {
      const viewerTierInfo = await accessService.resolveViewerTier({
        viewerId: row.userId,
        creatorId: row.meta.creatorId
      });

      const requiredRank = row.meta.minTierRank !== undefined ? row.meta.minTierRank : 0;
      if (!accessService.canAccess(viewerTierInfo.rank, requiredRank)) {
        await outboxStore.markSkipped(row.id, { reason: 'access_revoked' });
        return { status: 'skipped', error: 'access_revoked' };
      }
    }

    // 4. Send via configured driver
    const driver = getMailDriver();
    const result = await driver.send({
      to: row.toEmail,
      from: env.EMAIL_FROM,
      subject: row.subject,
      html: row.html,
      text: row.text,
      headers: {
        'List-Unsubscribe': `<${buildUnsubscribeUrl({ userId: row.userId, type: row.type })}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      }
    });

    await outboxStore.markSent(row.id, { messageId: result.messageId });
    return { status: 'sent' };
  } catch (err) {
    const isTransient = err.isTransient ?? true;
    const nextAttemptAt = calculateNextAttempt(row.attempts || 0);

    await outboxStore.markFailed(row.id, {
      error: err.message,
      isTransient,
      nextAttemptAt,
      maxAttempts: env.EMAIL_MAX_ATTEMPTS
    });

    return { status: 'failed', error: err.message };
  }
}

module.exports = {
  dedupeKeys,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  buildUnsubscribeUrl,
  calculateNextAttempt,
  processOutboxRow
};
