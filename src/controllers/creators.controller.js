const { userStore } = require('../store');
const ApiError = require('../utils/apiError');

/**
 * Get public creator profile by ID
 */
const getCreatorProfile = async (req, res) => {
  const { id } = req.params;
  const user = await userStore.findById(id);

  if (!user || user.role !== 'creator') {
    throw ApiError.notFound('Creator not found');
  }

  res.status(200).json({
    creator: {
      id: user.id,
      name: user.name,
      displayName: user.displayName,
      bio: user.bio,
      createdAt: user.createdAt
    }
  });
};

/**
 * Update authenticated creator's profile
 */
const updateMyProfile = async (req, res) => {
  const { displayName, bio } = req.body;

  const updatedUser = await userStore.update(req.user.id, {
    displayName,
    bio
  });

  if (!updatedUser) {
    throw ApiError.notFound('Creator profile could not be found');
  }

  res.status(200).json({
    creator: {
      id: updatedUser.id,
      name: updatedUser.name,
      displayName: updatedUser.displayName,
      bio: updatedUser.bio,
      updatedAt: updatedUser.updatedAt
    }
  });
};

module.exports = {
  getCreatorProfile,
  updateMyProfile
};
