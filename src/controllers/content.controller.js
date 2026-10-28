const { contentStore } = require('../store');
const ApiError = require('../utils/apiError');

/**
 * Create content (Creator only)
 */
const createContent = async (req, res) => {
  const { title, body, minTier = 'free' } = req.body;

  const content = await contentStore.create({
    creatorId: req.user.id,
    title,
    body,
    minTier
  });

  res.status(201).json({
    content
  });
};

/**
 * List all content (Paginated)
 */
const listContent = async (req, res) => {
  const { page, limit } = req.query;

  const result = await contentStore.findAll({ page, limit });

  // TODO(v0.3): In v0.3, filter or truncate full content bodies based on viewer's subscription tier
  // e.g. Free subscribers should only see preview text if minTier is 'pro' or 'vip'.

  res.status(200).json({
    items: result.items,
    pagination: result.pagination
  });
};

/**
 * Get a single content item by ID
 */
const getContentById = async (req, res) => {
  const { id } = req.params;

  const content = await contentStore.findById(id);
  if (!content) {
    throw ApiError.notFound('Content not found');
  }

  // TODO(v0.3): Enforce subscription tier access check (requireTier middleware or payload truncation)
  // If subscriber's active subscription tier < content.minTier, redact full body and provide preview only.

  res.status(200).json({
    content
  });
};

/**
 * Update content item (Owner creator only)
 */
const updateContent = async (req, res) => {
  const { id } = req.params;
  const { title, body, minTier } = req.body;

  const existingContent = await contentStore.findById(id);
  if (!existingContent) {
    throw ApiError.notFound('Content not found');
  }

  // Ownership check: only creator who authored this post can edit
  if (existingContent.creatorId !== req.user.id) {
    throw ApiError.forbidden('You can only edit content you authored');
  }

  const updatedContent = await contentStore.update(id, {
    title,
    body,
    minTier
  });

  res.status(200).json({
    content: updatedContent
  });
};

/**
 * Delete content item (Owner creator only)
 */
const deleteContent = async (req, res) => {
  const { id } = req.params;

  const existingContent = await contentStore.findById(id);
  if (!existingContent) {
    throw ApiError.notFound('Content not found');
  }

  // Ownership check: only creator who authored this post can delete
  if (existingContent.creatorId !== req.user.id) {
    throw ApiError.forbidden('You can only delete content you authored');
  }

  await contentStore.delete(id);

  res.status(200).json({
    message: 'Content deleted successfully'
  });
};

module.exports = {
  createContent,
  listContent,
  getContentById,
  updateContent,
  deleteContent
};
