'use strict';

const env = require('../config/env');
const trendingStore = require('../store/trendingStore');
const mediaStore = require('../store/mediaStore');
const reactionStore = require('../store/reactionStore');
const commentStore = require('../store/commentStore');
const accessService = require('./accessService');
const mediaService = require('./mediaService');
const { formatContentItem } = require('../presenters/contentPresenter');
const { calculateTrendingScore } = require('./math/trendingScore');

const trendingService = {
  /**
   * Recomputes trending scores for all recent content and atomically replaces the table.
   *
   * @param {Object} [params]
   * @param {Date} [params.now=new Date()]
   * @returns {Promise<{ computedCount: number, computedAt: Date }>}
   */
  async computeTrending({ now = new Date() } = {}) {
    const candidates = await trendingStore.fetchRecentContentCandidates({
      windowDays: env.TRENDING_WINDOW_DAYS
    });

    const scored = [];
    for (const c of candidates) {
      const ageHours = Math.max(
        0,
        (now.getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60)
      );
      const score = calculateTrendingScore(
        {
          views: c.views,
          commenters: c.commenters,
          likes: c.likes,
          ageHours
        },
        {
          weightViews: env.TRENDING_WEIGHT_VIEWS,
          weightComments: env.TRENDING_WEIGHT_COMMENTS,
          weightLikes: env.TRENDING_WEIGHT_LIKES,
          gravity: env.TRENDING_GRAVITY
        }
      );

      // Only rank items with positive engagement
      if (score > 0) {
        scored.push({
          contentId: c.id,
          score,
          createdAt: c.createdAt
        });
      }
    }

    // Sort descending by score; tiebreak with newer first, then contentId asc
    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.contentId.localeCompare(b.contentId);
    });

    const maxItems = Math.min(Math.max(1, env.TRENDING_MAX_ITEMS || 50), 100);
    const topScored = scored.slice(0, maxItems);

    const rankedRows = topScored.map((item, index) => ({
      contentId: item.contentId,
      score: Math.round(item.score * 10000) / 10000,
      rankPosition: index + 1,
      computedAt: now
    }));

    await trendingStore.replaceTrending(rankedRows);

    return {
      computedCount: rankedRows.length,
      computedAt: now
    };
  },

  /**
   * Fetches trending items with full access presentation, media signing, and reaction counts.
   *
   * @param {Object} [params]
   * @param {Object} [params.viewer=null]
   * @param {number} [params.limit=10]
   * @param {boolean} [params.accessibleOnly=false]
   * @returns {Promise<{ computedAt: Date|null, items: Array<{ rank: number, score: number, item: Object }> }>}
   */
  async getTrending({ viewer = null, limit = 10, accessibleOnly = false } = {}) {
    const rawTrending = await trendingStore.getTrending({ limit: env.TRENDING_MAX_ITEMS || 50 });

    if (!rawTrending || rawTrending.items.length === 0) {
      return {
        computedAt: rawTrending ? rawTrending.computedAt : null,
        items: []
      };
    }

    const rawContents = rawTrending.items.map((t) => t.content);
    const contentIds = rawContents.map((c) => c.id);

    // 1. Resolve viewer's access across all trending posts in a single query
    const accessMap = await accessService.resolveAccessBulk({
      viewer,
      contents: rawContents
    });

    // 2. Batch load media, reactions, and comments in parallel
    const [mediaMap, likesMap, commentsMap] = await Promise.all([
      mediaStore.listByContentIds(contentIds),
      reactionStore.batchGetLikes(contentIds, viewer ? viewer.id : null),
      commentStore.countByContentIds(contentIds)
    ]);

    const formattedList = [];
    for (const t of rawTrending.items) {
      const acc = accessMap.get(t.content.id) || { hasAccess: false, viewerTier: 'free' };

      if (accessibleOnly && !acc.hasAccess) {
        continue;
      }

      const rawMedia = mediaMap.get(t.content.id) || [];
      const signedMedia = mediaService.signMediaList(rawMedia, acc.hasAccess);
      const likeData = likesMap.get(t.content.id) || { likeCount: 0, likedByMe: false };
      const commentCount = commentsMap.get(t.content.id) || 0;

      const presentedItem = formatContentItem({
        item: {
          ...t.content,
          mediaCount: rawMedia.length,
          likeCount: likeData.likeCount,
          likedByMe: likeData.likedByMe,
          commentCount
        },
        hasAccess: acc.hasAccess,
        viewerTier: acc.viewerTier,
        mediaItems: signedMedia
      });

      formattedList.push({
        rank: t.rank,
        score: t.score,
        item: presentedItem
      });
    }

    const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 10), 50);
    return {
      computedAt: rawTrending.computedAt,
      items: formattedList.slice(0, safeLimit)
    };
  }
};

module.exports = trendingService;
