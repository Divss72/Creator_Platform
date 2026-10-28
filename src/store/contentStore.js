const { Content, Tier, User, CreatorProfile } = require('../models');

const formatContent = (contentInstance) => {
  if (!contentInstance) return null;
  const content = contentInstance.get({ plain: true });
  return {
    id: content.id,
    creatorId: content.creatorId,
    title: content.title,
    body: content.body,
    minTier: content.minTier ? content.minTier.name : 'free',
    createdAt: content.createdAt,
    updatedAt: content.updatedAt
  };
};

const contentStore = {
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

    return {
      id: newContent.id,
      creatorId: newContent.creatorId,
      title: newContent.title,
      body: newContent.body,
      minTier: tier.name,
      createdAt: newContent.createdAt,
      updatedAt: newContent.updatedAt
    };
  },

  /**
   * Paginated listing of content items with eager-loaded creator (no N+1)
   */
  async findAll({ page = 1, limit = 10 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    // Eager loading creator and minTier in a single query
    const { count, rows } = await Content.findAndCountAll({
      offset,
      limit: limitNum,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Tier, as: 'minTier', attributes: ['name', 'rank'] },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name'],
          include: [{ model: CreatorProfile, as: 'profile', attributes: ['displayName'] }]
        }
      ]
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
   * Find a content item by ID
   */
  async findById(id) {
    if (!id) return null;

    const item = await Content.findByPk(id, {
      include: [
        { model: Tier, as: 'minTier', attributes: ['name', 'rank'] },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name'],
          include: [{ model: CreatorProfile, as: 'profile', attributes: ['displayName'] }]
        }
      ]
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

    // Reload with associations
    const reloaded = await Content.findByPk(id, {
      include: [{ model: Tier, as: 'minTier' }]
    });

    return formatContent(reloaded);
  },

  /**
   * Delete content item
   */
  async delete(id) {
    const deletedCount = await Content.destroy({ where: { id } });
    return deletedCount > 0;
  }
};

module.exports = contentStore;
