const commentService = require('../services/commentService');

/**
 * List comments on a content item (Chat History)
 * Route: GET /api/content/:id/comments?limit=50&before=<commentId>
 * Uses optionalAuth. Applies paywall access control.
 */
const listComments = async (req, res) => {
  const { id } = req.params;
  const { limit, before } = req.query;

  const result = await commentService.listComments({
    viewer: req.user,
    contentId: id,
    limit,
    before
  });

  res.status(200).json(result);
};

module.exports = {
  listComments
};
