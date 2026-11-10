'use strict';

const env = require('../config/env');
const contentStore = require('../store/contentStore');
const viewStore = require('../store/viewStore');
const accessService = require('./accessService');
const { generateViewerKey } = require('./math/viewKey');
const { toUtcDateString } = require('./math/series');
const ApiError = require('../utils/apiError');

const BOT_USER_AGENT_REGEX =
  /bot|crawler|spider|crawling|curl|wget|slurp|facebookexternalhit|baiduspider|archive\.org_bot/i;

const viewService = {
  /**
   * Records a post view with server-side access determination and daily privacy deduplication.
   *
   * @param {Object} params
   * @param {string} params.contentId Content UUID
   * @param {Object} [params.viewer] Authenticated viewer object or null
   * @param {string} [params.ip] Client IP address
   * @param {string} [params.userAgent] Client User-Agent header
   * @param {Date} [params.now=new Date()] Injectable clock
   * @returns {Promise<{ counted: boolean, reason?: string }>}
   */
  async recordPostView({
    contentId,
    viewer = null,
    ip = '127.0.0.1',
    userAgent = '',
    now = new Date()
  }) {
    if (!contentId) {
      throw ApiError.badRequest('contentId is required');
    }

    // 1. Verify content existence
    const content = await contentStore.findById(contentId);
    if (!content) {
      throw ApiError.notFound('Content not found');
    }

    // 2. Filter out obvious bot User-Agents or anonymous requests with missing User-Agent
    const ua = (userAgent || '').trim();
    if ((!viewer && !ua) || BOT_USER_AGENT_REGEX.test(ua)) {
      return { counted: false, reason: 'bot' };
    }

    // 3. Exclude author/owner's self-views
    if (viewer && content.creatorId === viewer.id) {
      return { counted: false, reason: 'owner' };
    }

    // 4. Server determines lock state without trusting client
    const access = await accessService.resolveAccess({ viewer, content });
    const isLocked = !access.hasAccess;

    // 5. Generate daily privacy-safe HMAC key
    const day = toUtcDateString(now);
    const viewerKey = generateViewerKey({
      secret: env.ANALYTICS_HASH_SECRET,
      day,
      userId: viewer ? viewer.id : null,
      ip,
      userAgent: ua
    });

    // 6. Record deduplicated view in database
    const result = await viewStore.recordView({
      contentId,
      viewerKey,
      day,
      isLocked
    });

    return { counted: result.recorded };
  }
};

module.exports = viewService;
