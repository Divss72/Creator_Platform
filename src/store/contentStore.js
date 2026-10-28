const crypto = require('crypto');

// In-memory store holding content records
const contents = [];

const contentStore = {
  /**
   * Create a new content item
   */
  async create({ creatorId, title, body, minTier = 'free' }) {
    const now = new Date();
    const newContent = {
      id: crypto.randomUUID(),
      creatorId,
      title,
      body,
      minTier: minTier || 'free',
      createdAt: now,
      updatedAt: now
    };

    contents.unshift(newContent); // Newest first
    return { ...newContent };
  },

  /**
   * Paginated listing of content items
   */
  async findAll({ page = 1, limit = 10 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const total = contents.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const offset = (pageNum - 1) * limitNum;

    const items = contents.slice(offset, offset + limitNum).map((item) => ({ ...item }));

    return {
      items,
      pagination: {
        total,
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
    const item = contents.find((c) => c.id === id);
    return item ? { ...item } : null;
  },

  /**
   * Update content item
   */
  async update(id, updates) {
    const index = contents.findIndex((c) => c.id === id);
    if (index === -1) return null;

    const current = contents[index];
    const allowedFields = ['title', 'body', 'minTier'];
    const filteredUpdates = {};

    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    const updated = {
      ...current,
      ...filteredUpdates,
      updatedAt: new Date()
    };

    contents[index] = updated;
    return { ...updated };
  },

  /**
   * Delete content item
   */
  async delete(id) {
    const index = contents.findIndex((c) => c.id === id);
    if (index === -1) return false;

    contents.splice(index, 1);
    return true;
  },

  /**
   * Reset store (used for tests)
   */
  async reset() {
    contents.length = 0;
  }
};

module.exports = contentStore;
