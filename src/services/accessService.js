const tierStore = require('../store/tierStore');
const subscriptionStore = require('../store/subscriptionStore');
const { isActiveSubscription } = require('../utils/subscriptionStatus');

/**
 * Pure function: returns true if viewerRank is sufficient for requiredRank
 * @param {number} viewerRank
 * @param {number} requiredRank
 * @returns {boolean}
 */
const canAccess = (viewerRank, requiredRank) => {
  if (typeof viewerRank !== 'number' || typeof requiredRank !== 'number') {
    return false;
  }
  return viewerRank >= requiredRank;
};

/**
 * Build a viewer's access profile in a single query.
 * Memoised per-request in GraphQL context.
 *
 * @param {Object} params
 * @param {string|null} params.viewerId
 * @returns {Promise<{ viewerId: string|null, defaultRank: number, rankByCreatorId: Map<string, number> }>}
 */
const getViewerAccessProfile = async ({ viewerId }) => {
  const freeTier = (await tierStore.getByName('free')) || { name: 'free', rank: 0 };
  const defaultRank = freeTier.rank;
  const rankByCreatorId = new Map();

  if (!viewerId) {
    return {
      viewerId: null,
      defaultRank,
      rankByCreatorId
    };
  }

  // Active, non-expired subscriptions in a single query
  const subscriptions = await subscriptionStore.findActiveBySubscriber(viewerId);
  for (const sub of subscriptions) {
    rankByCreatorId.set(sub.creatorId, sub.tierRank);
  }

  return {
    viewerId,
    defaultRank,
    rankByCreatorId
  };
};

/**
 * Resolve access using a pre-fetched viewer access profile in memory (no extra DB query).
 *
 * @param {Object} params
 * @param {Object} params.profile - Pre-fetched profile from getViewerAccessProfile
 * @param {Object} params.content - Content item object
 * @param {Map<string, number>} [params.tierRankMap] - Optional memoized map of tier name -> rank
 * @returns {Promise<{ hasAccess: boolean, viewerTier: string, requiredTier: string }>}
 */
const resolveAccessFromProfile = async ({ profile, content, tierRankMap }) => {
  let rankMap = tierRankMap;
  if (!rankMap) {
    const allTiers = await tierStore.findAll();
    rankMap = new Map(allTiers.map((t) => [t.name, t.rank]));
  }
  const vipRank = rankMap.get('vip') ?? 2;

  let viewerRank = profile ? profile.defaultRank : 0;
  let viewerTier = 'free';

  if (profile && profile.viewerId && profile.viewerId === content.creatorId) {
    // Owner rule: full access (VIP)
    viewerTier = 'vip';
    viewerRank = vipRank;
  } else if (profile && profile.viewerId && profile.rankByCreatorId.has(content.creatorId)) {
    viewerRank = profile.rankByCreatorId.get(content.creatorId);
    for (const [name, rank] of rankMap.entries()) {
      if (rank === viewerRank) {
        viewerTier = name;
        break;
      }
    }
  }

  const requiredTierName = content.minTier || 'free';
  const requiredRank = rankMap.get(requiredTierName) ?? 0;
  const hasAccess = canAccess(viewerRank, requiredRank);

  return {
    hasAccess,
    viewerTier,
    requiredTier: requiredTierName
  };
};

/**
 * Resolve the effective tier of a viewer for a specific creator.
 * Rules:
 * 1. Owner: viewer IS the creator -> full access (rank 2, source: 'owner')
 * 2. Active subscription -> subscription's tier (source: 'subscription')
 * 3. Default -> free tier (rank 0, source: 'none')
 *
 * @param {Object} params
 * @param {string|null} params.viewerId
 * @param {string} params.creatorId
 * @returns {Promise<{ tier: string, rank: number, source: 'owner' | 'subscription' | 'none' }>}
 */
const resolveViewerTier = async ({ viewerId, creatorId }) => {
  // 1. Owner rule
  if (viewerId && creatorId && viewerId === creatorId) {
    const highestTier = (await tierStore.getByName('vip')) || { name: 'vip', rank: 2 };
    return {
      tier: highestTier.name,
      rank: highestTier.rank,
      source: 'owner'
    };
  }

  // 2. Active subscription rule
  if (viewerId && creatorId) {
    const sub = await subscriptionStore.findBySubscriberAndCreator(viewerId, creatorId);
    const now = new Date();

    if (sub && isActiveSubscription(sub, now)) {
      return {
        tier: sub.tier,
        rank: sub.tierRank,
        source: 'subscription'
      };
    }
  }

  // 3. Default rule (anonymous, un-subscribed, cancelled, or expired)
  const freeTier = (await tierStore.getByName('free')) || { name: 'free', rank: 0 };
  return {
    tier: freeTier.name,
    rank: freeTier.rank,
    source: 'none'
  };
};

/**
 * Resolve access permissions for a single content item.
 * @param {Object} params
 * @param {Object|null} params.viewer - Authenticated user or null
 * @param {Object} params.content - Content item object
 * @returns {Promise<{ hasAccess: boolean, viewerTier: string, requiredTier: string }>}
 */
const resolveAccess = async ({ viewer, content }) => {
  const viewerId = viewer ? viewer.id : null;
  const viewerTierInfo = await resolveViewerTier({
    viewerId,
    creatorId: content.creatorId
  });

  const requiredTierName = content.minTier || 'free';
  const tierRecord = await tierStore.getByName(requiredTierName);
  const requiredRank = tierRecord ? tierRecord.rank : 0;

  const hasAccess = canAccess(viewerTierInfo.rank, requiredRank);

  return {
    hasAccess,
    viewerTier: viewerTierInfo.tier,
    requiredTier: requiredTierName
  };
};

/**
 * Bulk resolve access permissions for a list of content items in a single pass.
 * Executes ONE query for viewer's subscriptions across all creators on the page (no N+1).
 *
 * @param {Object} params
 * @param {Object|null} params.viewer
 * @param {Object[]} params.contents
 * @returns {Promise<Map<string, { hasAccess: boolean, viewerTier: string, requiredTier: string }>>}
 */
const resolveAccessBulk = async ({ viewer, contents }) => {
  const resultMap = new Map();
  if (!contents || contents.length === 0) {
    return resultMap;
  }

  const allTiers = await tierStore.findAll();
  const tierRankMap = new Map(allTiers.map((t) => [t.name, t.rank]));
  const vipRank = tierRankMap.get('vip') ?? 2;

  const viewerId = viewer ? viewer.id : null;
  const uniqueCreatorIds = [...new Set(contents.map((c) => c.creatorId).filter(Boolean))];

  // Fetch all active subscriptions across all creators on the page in ONE single query
  let activeSubsMap = new Map();
  if (viewerId && uniqueCreatorIds.length > 0) {
    activeSubsMap = await subscriptionStore.findActiveByViewerAndCreators(viewerId, uniqueCreatorIds);
  }

  for (const item of contents) {
    let viewerTier = 'free';
    let viewerRank = 0;

    if (viewerId && viewerId === item.creatorId) {
      viewerTier = 'vip';
      viewerRank = vipRank;
    } else if (viewerId && activeSubsMap.has(item.creatorId)) {
      const sub = activeSubsMap.get(item.creatorId);
      viewerTier = sub.tier;
      viewerRank = sub.tierRank;
    }

    const requiredTier = item.minTier || 'free';
    const requiredRank = tierRankMap.get(requiredTier) ?? 0;
    const hasAccess = canAccess(viewerRank, requiredRank);

    resultMap.set(item.id, {
      hasAccess,
      viewerTier,
      requiredTier
    });
  }

  return resultMap;
};

/**
 * Paged fan-out query that returns active subscribers whose tier rank >= requiredRank.
 * Used by new-post email fan-out. Never leaks inactive or under-tiered users.
 *
 * @param {Object} params
 * @param {string} params.creatorId
 * @param {number} [params.requiredRank=0]
 * @param {string} [params.afterUserId]
 * @param {number} [params.limit=100]
 * @returns {Promise<Array<{ userId: string, email: string, name: string, tierName: string, tierRank: number }>>}
 */
const getEligibleSubscribers = async ({ creatorId, requiredRank = 0, afterUserId, limit = 100 }) => {
  return subscriptionStore.findEligibleSubscribers({
    creatorId,
    minTierRank: requiredRank,
    afterUserId,
    limit
  });
};

module.exports = {
  getEligibleSubscribers,
  canAccess,
  getViewerAccessProfile,
  resolveAccessFromProfile,
  resolveViewerTier,
  resolveAccess,
  resolveAccessBulk
};
