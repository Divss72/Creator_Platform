'use strict';

const { Op } = require('sequelize');
const { sequelize, User, CreatorProfile } = require('../models');

const sanitize = (user) => {
  if (!user) return null;
  // Never leak password hashes
  const { passwordHash, password_hash, ...safeUser } = user;
  return safeUser;
};

const formatUser = (userInstance) => {
  if (!userInstance) return null;
  const user = userInstance.get({ plain: true });
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    role: user.role,
    displayName: user.profile ? user.profile.displayName : user.name,
    bio: user.profile ? user.profile.bio : '',
    avatarUrl: user.profile ? user.profile.avatarUrl : null,
    avatarPublicId: user.profile ? user.profile.avatarPublicId : null,
    notifyNewPosts: user.notifyNewPosts !== undefined ? Boolean(user.notifyNewPosts) : true,
    notifyWeeklyDigest: user.notifyWeeklyDigest !== undefined ? Boolean(user.notifyWeeklyDigest) : true,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
};

const userStore = {
  /**
   * Create a new user record.
   * If role is creator, creates User and CreatorProfile inside ONE transaction.
   */
  async create({ name, email, passwordHash, role, displayName, bio = '' }) {
    const transaction = await sequelize.transaction();

    try {
      const user = await User.create(
        {
          name,
          email: email.toLowerCase().trim(),
          passwordHash,
          role
        },
        { transaction }
      );

      let profile = null;
      if (role === 'creator') {
        profile = await CreatorProfile.create(
          {
            userId: user.id,
            displayName: displayName || name,
            bio: bio || ''
          },
          { transaction }
        );
      }

      await transaction.commit();

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role,
        displayName: profile ? profile.displayName : user.name,
        bio: profile ? profile.bio : '',
        avatarUrl: null,
        avatarPublicId: null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  /**
   * Find user by email address (case-insensitive) including profile
   */
  async findByEmail(email) {
    if (!email) return null;
    const normalized = email.toLowerCase().trim();

    const user = await User.findOne({
      where: { email: normalized },
      include: [{ model: CreatorProfile, as: 'profile' }]
    });

    return formatUser(user);
  },

  /**
   * Find user by ID including profile
   */
  async findById(id) {
    if (!id) return null;

    const user = await User.findByPk(id, {
      include: [{ model: CreatorProfile, as: 'profile' }]
    });

    return formatUser(user);
  },

  /**
   * Bulk find creators by IDs for DataLoader batching.
   * Only returns users with role 'creator'.
   * Strictly omits private fields (email, passwordHash).
   * @param {string[]} ids
   * @returns {Promise<Map<string, { id: string, displayName: string, bio: string, avatarUrl: string|null }>>}
   */
  async findCreatorsByIds(ids) {
    const map = new Map();
    if (!ids || ids.length === 0) return map;

    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (uniqueIds.length === 0) return map;

    const users = await User.findAll({
      where: {
        id: { [Op.in]: uniqueIds },
        role: 'creator'
      },
      include: [{ model: CreatorProfile, as: 'profile' }]
    });

    for (const u of users) {
      const plain = u.get({ plain: true });
      map.set(plain.id, {
        id: plain.id,
        displayName: plain.profile ? plain.profile.displayName : plain.name,
        bio: plain.profile ? plain.profile.bio : null,
        avatarUrl: plain.profile ? plain.profile.avatarUrl : null
      });
    }

    return map;
  },

  /**
   * Find a single creator by ID (returns null if not found or not a creator).
   * Strictly omits private fields (email, passwordHash).
   * @param {string} id
   * @returns {Promise<{ id: string, displayName: string, bio: string, avatarUrl: string|null }|null>}
   */
  async findCreatorById(id) {
    if (!id) return null;
    const user = await User.findOne({
      where: { id, role: 'creator' },
      include: [{ model: CreatorProfile, as: 'profile' }]
    });
    if (!user) return null;
    const plain = user.get({ plain: true });
    return {
      id: plain.id,
      displayName: plain.profile ? plain.profile.displayName : plain.name,
      bio: plain.profile ? plain.profile.bio : null,
      avatarUrl: plain.profile ? plain.profile.avatarUrl : null
    };
  },

  /**
   * Update avatar for a creator profile.
   * Returns old avatarPublicId (if any) so old asset can be destroyed.
   */
  async updateAvatar(userId, { avatarUrl, avatarPublicId }) {
    const profile = await CreatorProfile.findOne({ where: { userId } });
    if (!profile) return null;

    const oldAvatarPublicId = profile.avatarPublicId;
    await profile.update({ avatarUrl, avatarPublicId });
    return { oldAvatarPublicId, avatarUrl };
  },

  /**
   * Update an existing user's profile
   */
  async update(id, updates) {
    const transaction = await sequelize.transaction();

    try {
      const user = await User.findByPk(id, {
        include: [{ model: CreatorProfile, as: 'profile' }],
        transaction
      });

      if (!user) {
        await transaction.rollback();
        return null;
      }

      if (updates.name !== undefined) {
        await user.update({ name: updates.name }, { transaction });
      }

      if (user.role === 'creator') {
        const profileUpdates = {};
        if (updates.displayName !== undefined) profileUpdates.displayName = updates.displayName;
        if (updates.bio !== undefined) profileUpdates.bio = updates.bio;

        if (Object.keys(profileUpdates).length > 0) {
          if (user.profile) {
            await user.profile.update(profileUpdates, { transaction });
          } else {
            user.profile = await CreatorProfile.create(
              {
                userId: user.id,
                displayName: updates.displayName || user.name,
                bio: updates.bio || ''
              },
              { transaction }
            );
          }
        }
      }

      await transaction.commit();

      // Reload updated values
      const updatedUser = await User.findByPk(id, {
        include: [{ model: CreatorProfile, as: 'profile' }]
      });

      return formatUser(updatedUser);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  /**
   * Helper to strip sensitive data
   */
  /**
   * Update notification preferences for a user
   * @param {string} id
   * @param {Object} prefs
   * @param {boolean} [prefs.notifyNewPosts]
   * @param {boolean} [prefs.notifyWeeklyDigest]
   * @returns {Promise<{ notifyNewPosts: boolean, notifyWeeklyDigest: boolean }|null>}
   */
  async updateNotificationPreferences(id, prefs) {
    const user = await User.findByPk(id);
    if (!user) return null;

    const updates = {};
    if (prefs.notifyNewPosts !== undefined) {
      updates.notifyNewPosts = Boolean(prefs.notifyNewPosts);
    }
    if (prefs.notifyWeeklyDigest !== undefined) {
      updates.notifyWeeklyDigest = Boolean(prefs.notifyWeeklyDigest);
    }

    if (Object.keys(updates).length > 0) {
      await user.update(updates);
    }

    return {
      notifyNewPosts: user.notifyNewPosts,
      notifyWeeklyDigest: user.notifyWeeklyDigest
    };
  },

  /**
   * Paged query of users eligible for weekly digest (notifyWeeklyDigest = true).
   * @param {Object} options
   * @param {string} [options.afterUserId]
   * @param {number} [options.limit=100]
   * @returns {Promise<Array<{ id: string, name: string, email: string }>>}
   */
  async findDigestEligibleUsers({ afterUserId, limit = 100 } = {}) {
    const where = {
      notifyWeeklyDigest: true
    };
    if (afterUserId) {
      where.id = { [Op.gt]: afterUserId };
    }

    const users = await User.findAll({
      where,
      attributes: ['id', 'name', 'email'],
      order: [['id', 'ASC']],
      limit
    });

    return users.map((u) => u.get({ plain: true }));
  },

  /**
   * List all creator IDs for reconciliation jobs.
   * @returns {Promise<string[]>}
   */
  async listAllCreatorIds() {
    const creators = await User.findAll({
      where: { role: 'creator' },
      attributes: ['id']
    });
    return creators.map((c) => c.id);
  },

  sanitize
};

module.exports = userStore;
