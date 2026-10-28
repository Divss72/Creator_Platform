const tierStore = require('../store/tierStore');
const subscriptionStore = require('../store/subscriptionStore');

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

    if (sub && sub.status === 'active' && (!sub.endsAt || sub.endsAt > now)) {
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

module.exports = {
  canAccess,
  resolveViewerTier,
  resolveAccess,
  resolveAccessBulk
};
