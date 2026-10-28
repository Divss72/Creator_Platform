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
  sanitize
};

module.exports = userStore;
