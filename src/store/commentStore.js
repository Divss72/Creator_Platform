const { Op } = require('sequelize');
const { Comment, User } = require('../models');

/**
 * Strict allow-list serialization for comment objects.
 * Never exposes email, passwordHash, or internal model fields.
 */
const formatComment = (comment) => {
  if (!comment) return null;
  const user = comment.user || {};
  return {
    id: comment.id,
    contentId: comment.contentId,
    body: comment.body,
    createdAt: comment.createdAt,
    user: {
      id: user.id || comment.userId,
      name: user.name || '',
      role: user.role || ''
    }
  };
};

/**
 * Persist a new comment and return the populated domain object
 */
const create = async ({ contentId, userId, body }) => {
  const comment = await Comment.create({
    contentId,
    userId,
    body
  });

  const populated = await Comment.findByPk(comment.id, {
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'role']
      }
    ]
  });

  return formatComment(populated);
};

/**
 * Find comment by ID
 */
const findById = async (id) => {
  const comment = await Comment.findByPk(id, {
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'role']
      }
    ]
  });

  return formatComment(comment);
};

/**
 * Query paginated comments by content ID using cursor pagination.
 *
 * @param {Object} params
 * @param {string} params.contentId
 * @param {number} [params.limit=50]
 * @param {string|null} [params.before=null]
 * @returns {Promise<{ items: Array, nextBefore: string|null }>}
 */
const listByContentWithCursor = async ({ contentId, limit = 50, before = null }) => {
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

  const whereClause = { contentId };

  if (before) {
    const reference = await Comment.findByPk(before, {
      attributes: ['id', 'createdAt']
    });

    if (reference) {
      whereClause[Op.or] = [
        {
          createdAt: {
            [Op.lt]: reference.createdAt
          }
        },
        {
          createdAt: reference.createdAt,
          id: {
            [Op.lt]: reference.id
          }
        }
      ];
    } else {
      // If cursor is unknown ID, fallback to ID comparison
      whereClause.id = { [Op.lt]: before };
    }
  }

  // Fetch limit + 1 in reverse chronological order to determine if older records exist
  const rows = await Comment.findAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'role']
      }
    ],
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC']
    ],
    limit: parsedLimit + 1
  });

  const hasMore = rows.length > parsedLimit;
  const pageRows = hasMore ? rows.slice(0, parsedLimit) : rows;

  // The nextBefore cursor points to the oldest comment on this page
  const nextBefore = hasMore ? pageRows[pageRows.length - 1].id : null;

  // Within the page, return sorted oldest-to-newest
  const sortedOldestToNewest = [...pageRows].reverse();

  return {
    items: sortedOldestToNewest.map(formatComment),
    nextBefore
  };
};

module.exports = {
  create,
  findById,
  listByContentWithCursor,
  formatComment
};
