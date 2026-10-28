const { Op } = require('sequelize');
const { sequelize, Subscription, Tier, User, CreatorProfile } = require('../models');

const formatSubscription = (instance) => {
  if (!instance) return null;
  const sub = instance.get({ plain: true });
  return {
    id: sub.id,
    subscriberId: sub.subscriberId,
    creatorId: sub.creatorId,
    tier: sub.tier ? sub.tier.name : 'free',
    tierRank: sub.tier ? sub.tier.rank : 0,
    status: sub.status,
    startedAt: sub.startedAt,
    endsAt: sub.endsAt,
    createdAt: sub.createdAt,
    updatedAt: sub.updatedAt,
    creator: sub.creator
      ? {
          id: sub.creator.id,
          name: sub.creator.name,
          displayName: sub.creator.profile ? sub.creator.profile.displayName : sub.creator.name
        }
      : undefined
  };
};

const subscriptionStore = {
  /**
   * Bulk query active subscriptions for a viewer across multiple creators in a single query (no N+1).
   * @param {string} viewerId
   * @param {string[]} creatorIds
   * @returns {Promise<Map<string, Object>>} Map of creatorId -> subscription
   */
  async findActiveByViewerAndCreators(viewerId, creatorIds) {
    const map = new Map();
    if (!viewerId || !creatorIds || creatorIds.length === 0) {
      return map;
    }

    const uniqueCreatorIds = [...new Set(creatorIds.filter(Boolean))];
    if (uniqueCreatorIds.length === 0) {
      return map;
    }

    const now = new Date();

    const subscriptions = await Subscription.findAll({
      where: {
        subscriberId: viewerId,
        creatorId: { [Op.in]: uniqueCreatorIds },
        status: 'active',
        [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gt]: now } }]
      },
      include: [{ model: Tier, as: 'tier' }]
    });

    for (const sub of subscriptions) {
      const formatted = formatSubscription(sub);
      map.set(formatted.creatorId, formatted);
    }

    return map;
  },

  /**
   * Find a single subscription by subscriber and creator
   */
  async findBySubscriberAndCreator(subscriberId, creatorId) {
    if (!subscriberId || !creatorId) return null;

    const sub = await Subscription.findOne({
      where: { subscriberId, creatorId },
      include: [{ model: Tier, as: 'tier' }]
    });

    return formatSubscription(sub);
  },

  /**
   * Subscribe, upgrade, downgrade, or re-activate a subscription
   * Handles concurrency and race conditions gracefully.
   */
  async subscribe({ subscriberId, creatorId, tierName }) {
    const tier = await Tier.findOne({ where: { name: tierName } });
    if (!tier) {
      throw new Error(`Tier '${tierName}' not found`);
    }

    const transaction = await sequelize.transaction();

    try {
      const existing = await Subscription.findOne({
        where: { subscriberId, creatorId },
        include: [{ model: Tier, as: 'tier' }],
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      const now = new Date();

      if (!existing) {
        // Create new subscription
        const newSub = await Subscription.create(
          {
            subscriberId,
            creatorId,
            tierId: tier.id,
            status: 'active',
            startedAt: now,
            endsAt: null
          },
          { transaction }
        );

        await transaction.commit();

        const reloaded = await Subscription.findByPk(newSub.id, {
          include: [{ model: Tier, as: 'tier' }]
        });

        return {
          subscription: formatSubscription(reloaded),
          isNew: true,
          statusCode: 201
        };
      }

      // Existing subscription check
      const isSameTier = existing.tierId === tier.id;
      const isActive = existing.status === 'active' && (!existing.endsAt || existing.endsAt > now);

      if (isSameTier && isActive) {
        // Idempotent: same tier and active
        await transaction.commit();
        return {
          subscription: formatSubscription(existing),
          isNew: false,
          statusCode: 200
        };
      }

      // Upgrade, downgrade, or re-activate cancelled/expired
      await existing.update(
        {
          tierId: tier.id,
          status: 'active',
          startedAt: now,
          endsAt: null
        },
        { transaction }
      );

      await transaction.commit();

      const reloaded = await Subscription.findByPk(existing.id, {
        include: [{ model: Tier, as: 'tier' }]
      });

      return {
        subscription: formatSubscription(reloaded),
        isNew: false,
        statusCode: 200
      };
    } catch (err) {
      await transaction.rollback();

      // Handle race condition on unique constraint gracefully
      if (err.name === 'SequelizeUniqueConstraintError') {
        const fallback = await Subscription.findOne({
          where: { subscriberId, creatorId },
          include: [{ model: Tier, as: 'tier' }]
        });
        if (fallback) {
          return {
            subscription: formatSubscription(fallback),
            isNew: false,
            statusCode: 200
          };
        }
      }

      throw err;
    }
  },

  /**
   * Cancel an existing subscription (marks status as 'cancelled')
   */
  async cancel({ subscriberId, creatorId }) {
    const existing = await Subscription.findOne({
      where: { subscriberId, creatorId },
      include: [{ model: Tier, as: 'tier' }]
    });

    if (!existing) return null;

    await existing.update({
      status: 'cancelled',
      endsAt: new Date()
    });

    const reloaded = await Subscription.findByPk(existing.id, {
      include: [{ model: Tier, as: 'tier' }]
    });

    return formatSubscription(reloaded);
  },

  /**
   * List all subscriptions belonging to a subscriber
   */
  async listBySubscriber(subscriberId) {
    const subscriptions = await Subscription.findAll({
      where: { subscriberId },
      include: [
        { model: Tier, as: 'tier' },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name'],
          include: [{ model: CreatorProfile, as: 'profile', attributes: ['displayName'] }]
        }
      ],
      order: [['updatedAt', 'DESC']]
    });

    return subscriptions.map(formatSubscription);
  }
};

module.exports = subscriptionStore;
