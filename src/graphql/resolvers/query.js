const ApiError = require('../../utils/apiError');
const contentStore = require('../../store/contentStore');
const accessService = require('../../services/accessService');
const commentService = require('../../services/commentService');
const { formatContentItem } = require('../../presenters/contentPresenter');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id) => typeof id === 'string' && UUID_REGEX.test(id);

/**
 * Checks whether totalCount is selected on the ContentConnection AST.
 */
const isTotalCountRequested = (info) => {
  if (!info || !info.fieldNodes) return false;
  for (const fieldNode of info.fieldNodes) {
    if (fieldNode.selectionSet) {
      for (const selection of fieldNode.selectionSet.selections) {
        if (selection.name && selection.name.value === 'totalCount') {
          return true;
        }
      }
    }
  }
  return false;
};

const queryResolvers = {
  /**
   * List all platform tiers with ranks and pricing.
   */
  async tiers(_parent, _args, context) {
    const tiers = await context.getTiers();
    return tiers.map((t) => ({
      name: t.name,
      rank: t.rank,
      priceCents: t.priceCents
    }));
  },

  /**
   * Paginated and filtered tiered content feed (keyset cursor pagination).
   */
  async feed(_parent, args, context, info) {
    const { filter = {}, first = 20, after } = args;

    // 1. Validate first: min 1, max 50
    if (typeof first !== 'number' || first < 1 || first > 50) {
      throw ApiError.validation('Argument "first" must be between 1 and 50');
    }

    // 2. Validate cursor if provided
    let afterCursor = null;
    if (after !== undefined && after !== null) {
      afterCursor = contentStore.decodeCursor(after);
      if (!afterCursor) {
        throw ApiError.validation('Invalid or malformed pagination cursor');
      }
    }

    // 3. Validate creatorId filter if provided
    if (filter.creatorId) {
      if (!isValidUUID(filter.creatorId)) {
        throw ApiError.validation('Invalid creatorId format');
      }
    }

    // 4. SubscribedOnly requires authentication
    if (filter.subscribedOnly && !context.viewer) {
      throw ApiError.unauthorized('Authentication required for subscribed feed');
    }

    // 5. Fetch viewer access profile and tier ranks (memoised in context)
    const accessProfile = await context.getAccessProfile();
    const tierRankMap = await context.getTierRankMap();

    // 6. Query feed items using keyset pagination
    const result = await contentStore.findFeedKeyset({
      filter,
      accessProfile,
      first,
      afterCursor
    });

    if (result.isUnauthenticated) {
      throw ApiError.unauthorized('Authentication required for subscribed feed');
    }

    // 7. Format items using shared contentPresenter
    const edges = [];
    for (const item of result.items) {
      const access = await accessService.resolveAccessFromProfile({
        profile: accessProfile,
        content: item,
        tierRankMap
      });

      const presented = formatContentItem({
        item,
        hasAccess: access.hasAccess,
        viewerTier: access.viewerTier
      });

      edges.push({
        cursor: contentStore.encodeCursor(item),
        node: presented
      });
    }

    // 8. totalCount: execute count query ONLY if requested by client
    let totalCount = 0;
    if (isTotalCountRequested(info)) {
      totalCount = await contentStore.countFeed({ filter, accessProfile });
    }

    return {
      edges,
      pageInfo: {
        hasNextPage: result.hasNextPage,
        endCursor: result.endCursor
      },
      totalCount
    };
  },

  /**
   * Single content item lookup by ID with paywall preview enforcement.
   */
  async content(_parent, args, context) {
    const { id } = args;
    if (!isValidUUID(id)) {
      throw ApiError.validation('Invalid content ID format');
    }

    const item = await contentStore.findById(id);
    if (!item) {
      throw ApiError.notFound('Content not found');
    }

    const accessProfile = await context.getAccessProfile();
    const tierRankMap = await context.getTierRankMap();

    const access = await accessService.resolveAccessFromProfile({
      profile: accessProfile,
      content: item,
      tierRankMap
    });

    return formatContentItem({
      item,
      hasAccess: access.hasAccess,
      viewerTier: access.viewerTier
    });
  },

  /**
   * Single creator profile lookup by ID.
   */
  async creator(_parent, args, context) {
    const { id } = args;
    if (!isValidUUID(id)) {
      throw ApiError.validation('Invalid creator ID format');
    }

    const creator = await context.loaders.creatorLoader.load(id);
    if (!creator) {
      return null;
    }

    return creator;
  },

  /**
   * Top-level content comments query with tier access check and cursor pagination.
   */
  async contentComments(_parent, args, context) {
    const { contentId, limit = 50, before } = args;

    if (!isValidUUID(contentId)) {
      throw ApiError.validation('Invalid content ID format');
    }

    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      throw ApiError.validation('Limit must be between 1 and 100');
    }

    if (before && !isValidUUID(before)) {
      throw ApiError.validation('Invalid before cursor ID format');
    }

    const result = await commentService.listComments({
      viewer: context.viewer,
      contentId,
      limit,
      before
    });

    return {
      items: result.items,
      nextBefore: result.nextBefore
    };
  },

  /**
   * Trending content items computed via gravity ranking.
   */
  async trending(_parent, args, context) {
    const { limit = 10, accessibleOnly = false } = args;

    if (typeof limit !== 'number' || limit < 1 || limit > 50) {
      throw ApiError.validation('Argument "limit" must be between 1 and 50');
    }

    const trendingService = require('../../services/trendingService');
    const result = await trendingService.getTrending({
      viewer: context.viewer,
      limit,
      accessibleOnly: Boolean(accessibleOnly)
    });

    return {
      computedAt: result.computedAt,
      items: result.items.map((entry) => ({
        rank: entry.rank,
        item: entry.item
      }))
    };
  }
};

module.exports = {
  Query: queryResolvers
};
