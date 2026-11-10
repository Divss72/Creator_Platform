const { Op } = require('sequelize');
const { Content, Tier, User, CreatorProfile } = require('../models');

const creatorInclude = {
  model: User,
  as: 'creator',
  attributes: ['id', 'name'],
  include: [{ model: CreatorProfile, as: 'profile', attributes: ['displayName', 'bio'] }]
};

const formatContent = (contentInstance) => {
  if (!contentInstance) return null;
  const content = contentInstance.get({ plain: true });
  return {
    id: content.id,
    creatorId: content.creatorId,
    title: content.title,
    body: content.body,
    minTier: content.minTier ? content.minTier.name : 'free',
    creator: content.creator
      ? {
          id: content.creator.id,
          name: content.creator.name,
          displayName: content.creator.profile
            ? content.creator.profile.displayName
            : content.creator.name,
          bio: content.creator.profile ? content.creator.profile.bio : null
        }
      : undefined,
    createdAt: content.createdAt,
    updatedAt: content.updatedAt
  };
};

const encodeCursor = (item) => {
  const dateStr =
    item.createdAt instanceof Date
      ? item.createdAt.toISOString()
      : new Date(item.createdAt).toISOString();
  return Buffer.from(JSON.stringify({ createdAt: dateStr, id: item.id }), 'utf8').toString(
    'base64'
  );
};

const decodeCursor = (cursorStr) => {
  if (!cursorStr || typeof cursorStr !== 'string') return null;
  try {
    const jsonStr = Buffer.from(cursorStr, 'base64').toString('utf8');
    const parsed = JSON.parse(jsonStr);
    if (!parsed || !parsed.createdAt || !parsed.id || typeof parsed.id !== 'string') {
      return null;
    }
    const createdAt = new Date(parsed.createdAt);
    if (isNaN(createdAt.getTime())) {
      return null;
    }
    return { createdAt, id: parsed.id };
  } catch (err) {
    return null;
  }
};

/**
 * Build Sequelize WHERE conditions for feed filtering based on access profile and user filters.
 */
const buildFeedConditions = ({ filter = {}, accessProfile = null }) => {
  const andConditions = [];

  // 1. Filter by specific creator
  if (filter.creatorId) {
    andConditions.push({ creatorId: filter.creatorId });
  }

  // 2. Filter by specific minimum tiers
  if (filter.minTiers && filter.minTiers.length > 0) {
    const lowerTiers = filter.minTiers.map((t) => t.toLowerCase());
    andConditions.push({ '$minTier.name$': { [Op.in]: lowerTiers } });
  }

  // 3. Filter by subscribed creators only (requires non-empty subscribed creators list)
  if (filter.subscribedOnly) {
    if (!accessProfile || !accessProfile.viewerId) {
      // Must be handled as UNAUTHENTICATED by caller
      return { isUnauthenticated: true };
    }
    const subscribedCreatorIds = Array.from(accessProfile.rankByCreatorId.keys()).filter(
      (id) => id !== accessProfile.viewerId
    );

    if (subscribedCreatorIds.length === 0) {
      // Viewer has no active subscriptions -> empty connection
      return { isEmpty: true };
    }
    andConditions.push({ creatorId: { [Op.in]: subscribedCreatorIds } });
  }

  // 4. Accessible only: SQL translation of accessProfile rules before pagination
  if (filter.accessibleOnly && accessProfile) {
    const accessibleOrConditions = [
      // Free posts for everyone
      { '$minTier.rank$': { [Op.lte]: accessProfile.defaultRank } }
    ];

    // Creator owns their own posts
    if (accessProfile.viewerId) {
      accessibleOrConditions.push({ creatorId: accessProfile.viewerId });
    }

    // Active subscriptions for this viewer
    for (const [creatorId, rank] of accessProfile.rankByCreatorId.entries()) {
      if (rank > accessProfile.defaultRank) {
        accessibleOrConditions.push({
          [Op.and]: [{ creatorId }, { '$minTier.rank$': { [Op.lte]: rank } }]
        });
      }
    }

    andConditions.push({ [Op.or]: accessibleOrConditions });
  }

  return {
    andConditions
  };
};

const contentStore = {
  encodeCursor,
  decodeCursor,

  /**
   * Create a new content item
   */
  async create({ creatorId, title, body, minTier = 'free' }) {
    const tier = await Tier.findOne({ where: { name: minTier || 'free' } });
    if (!tier) {
      throw new Error(`Tier '${minTier}' is not recognized`);
    }

    const newContent = await Content.create({
      creatorId,
      title,
      body,
      minTierId: tier.id
    });

    const reloaded = await Content.findByPk(newContent.id, {
      include: [{ model: Tier, as: 'minTier', attributes: ['name', 'rank'] }, creatorInclude]
    });

    return formatContent(reloaded);
  },

  /**
   * Paginated listing of content items for REST (offset-based)
   */
  async findAll({ page = 1, limit = 10 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const { count, rows } = await Content.findAndCountAll({
      offset,
      limit: limitNum,
      order: [['createdAt', 'DESC']],
      include: [{ model: Tier, as: 'minTier', attributes: ['name', 'rank'] }, creatorInclude]
    });

    const items = rows.map(formatContent);
    const totalPages = Math.ceil(count / limitNum) || 1;

    return {
      items,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    };
  },

  /**
   * Keyset cursor pagination for GraphQL feed (newest first: createdAt DESC, id DESC)
   */
  async findFeedKeyset({ filter = {}, accessProfile = null, first = 20, afterCursor = null }) {
    const feedConditions = buildFeedConditions({ filter, accessProfile });

    if (feedConditions.isUnauthenticated) {
      return { isUnauthenticated: true };
    }
    if (feedConditions.isEmpty) {
      return {
        items: [],
        hasNextPage: false,
        endCursor: null
      };
    }

    const andConditions = [...feedConditions.andConditions];

    // Keyset condition: (createdAt, id) < (afterCursor.createdAt, afterCursor.id)
    if (afterCursor) {
      andConditions.push({
        [Op.or]: [
          { createdAt: { [Op.lt]: afterCursor.createdAt } },
          {
            createdAt: afterCursor.createdAt,
            id: { [Op.lt]: afterCursor.id }
          }
        ]
      });
    }

    const whereClause = andConditions.length > 0 ? { [Op.and]: andConditions } : {};

    const rows = await Content.findAll({
      where: whereClause,
      include: [{ model: Tier, as: 'minTier', attributes: ['name', 'rank'] }, creatorInclude],
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC']
      ],
      limit: first + 1
    });

    const hasNextPage = rows.length > first;
    const pageRows = hasNextPage ? rows.slice(0, first) : rows;
    const items = pageRows.map(formatContent);
    const endCursor = items.length > 0 ? encodeCursor(items[items.length - 1]) : null;

    return {
      items,
      hasNextPage,
      endCursor
    };
  },

  /**
   * Count total posts matching the feed filter for the viewer (run ONLY when totalCount selected)
   */
  async countFeed({ filter = {}, accessProfile = null }) {
    const feedConditions = buildFeedConditions({ filter, accessProfile });

    if (feedConditions.isUnauthenticated || feedConditions.isEmpty) {
      return 0;
    }

    const whereClause =
      feedConditions.andConditions.length > 0 ? { [Op.and]: feedConditions.andConditions } : {};

    const count = await Content.count({
      where: whereClause,
      include: [{ model: Tier, as: 'minTier', attributes: [] }],
      distinct: true,
      col: 'id'
    });

    return count;
  },

  /**
   * Find a content item by ID
   */
  async findById(id) {
    if (!id) return null;

    const item = await Content.findByPk(id, {
      include: [{ model: Tier, as: 'minTier', attributes: ['name', 'rank'] }, creatorInclude]
    });

    return formatContent(item);
  },

  /**
   * Update content item
   */
  async update(id, updates) {
    const content = await Content.findByPk(id, {
      include: [{ model: Tier, as: 'minTier' }]
    });

    if (!content) return null;

    const updateFields = {};
    if (updates.title !== undefined) updateFields.title = updates.title;
    if (updates.body !== undefined) updateFields.body = updates.body;

    if (updates.minTier !== undefined) {
      const tier = await Tier.findOne({ where: { name: updates.minTier } });
      if (tier) {
        updateFields.minTierId = tier.id;
      }
    }

    await content.update(updateFields);

    const reloaded = await Content.findByPk(id, {
      include: [{ model: Tier, as: 'minTier', attributes: ['name', 'rank'] }, creatorInclude]
    });

    return formatContent(reloaded);
  },

  /**
   * Delete content item
   */
  async delete(id) {
    const deletedCount = await Content.destroy({ where: { id } });
    return deletedCount > 0;
  },

  /**
   * Find recent posts by creators published since a given date.
   * Used by weekly digest generator.
   *
   * @param {Object} params
   * @param {string[]} params.creatorIds
   * @param {Date} params.since
   * @param {number} [params.limit=100]
   * @returns {Promise<Array<{ id: string, creatorId: string, title: string, minTier: string, minTierRank: number, createdAt: Date }>>}
   */
  async findRecentPostsByCreators({ creatorIds, since, limit = 100 }) {
    if (!creatorIds || creatorIds.length === 0) return [];

    const posts = await Content.findAll({
      where: {
        creatorId: { [Op.in]: creatorIds },
        createdAt: { [Op.gte]: since }
      },
      include: [{ model: Tier, as: 'minTier', attributes: ['name', 'rank'] }],
      order: [['createdAt', 'DESC']],
      limit
    });

    return posts.map((p) => {
      const plain = p.get({ plain: true });
      return {
        id: plain.id,
        creatorId: plain.creatorId,
        title: plain.title,
        minTier: plain.minTier ? plain.minTier.name : 'free',
        minTierRank: plain.minTier ? plain.minTier.rank : 0,
        createdAt: plain.createdAt
      };
    });
  }
};

module.exports = contentStore;
