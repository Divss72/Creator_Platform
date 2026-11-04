'use strict';

const { Op } = require('sequelize');
const { sequelize, Media, Content } = require('../models');
const ApiError = require('../utils/apiError');
const { MEDIA } = require('../config/limits');

const formatMedia = (m) => {
  if (!m) return null;
  const item = m.get ? m.get({ plain: true }) : m;
  return {
    id: item.id,
    contentId: item.contentId || item.content_id,
    creatorId: item.creatorId || item.creator_id,
    kind: item.kind,
    publicId: item.publicId || item.public_id,
    format: item.format,
    bytes: item.bytes,
    width: item.width !== undefined ? item.width : null,
    height: item.height !== undefined ? item.height : null,
    durationSeconds: item.durationSeconds !== undefined ? item.durationSeconds : (item.duration_seconds !== undefined ? item.duration_seconds : null),
    originalName: item.originalName || item.original_name,
    position: item.position,
    createdAt: item.createdAt || item.created_at,
    updatedAt: item.updatedAt || item.updated_at
  };
};

const mediaStore = {
  /**
   * Find media items by content ID, ordered by position.
   */
  async findByContentId(contentId) {
    const rows = await Media.findAll({
      where: { contentId },
      order: [['position', 'ASC']]
    });
    return rows.map(formatMedia);
  },

  /**
   * Find media by content ID and media ID.
   */
  async findByPostAndId(contentId, mediaId) {
    const row = await Media.findOne({
      where: { id: mediaId, contentId }
    });
    return formatMedia(row);
  },

  /**
   * Batched lookup of media for a list of content IDs (for page rendering / DataLoader).
   * @param {string[]} contentIds
   * @returns {Promise<Map<string, Object[]>>}
   */
  async listByContentIds(contentIds) {
    const map = new Map();
    if (!contentIds || contentIds.length === 0) return map;

    const uniqueIds = [...new Set(contentIds.filter(Boolean))];
    for (const id of uniqueIds) {
      map.set(id, []);
    }

    const rows = await Media.findAll({
      where: {
        contentId: { [Op.in]: uniqueIds }
      },
      order: [
        ['contentId', 'ASC'],
        ['position', 'ASC']
      ]
    });

    for (const row of rows) {
      const formatted = formatMedia(row);
      const list = map.get(formatted.contentId);
      if (list) {
        list.push(formatted);
      }
    }

    return map;
  },

  /**
   * Get total storage bytes used by a creator across all media.
   */
  async getCreatorStorageUsed(creatorId, transaction = null) {
    const total = await Media.sum('bytes', {
      where: { creatorId },
      transaction
    });
    return total || 0;
  },

  /**
   * Preliminary check of limits before attempting upload to driver.
   */
  async checkLimitsPreUpload({ contentId, creatorId, newBytes }) {
    const existingCount = await Media.count({ where: { contentId } });
    if (existingCount >= MEDIA.MAX_PER_POST) {
      throw ApiError.mediaLimit('Media attachment limit reached (maximum 5 attachments per post)');
    }

    const currentUsed = await this.getCreatorStorageUsed(creatorId);
    if (currentUsed + newBytes > MEDIA.QUOTA_BYTES_PER_CREATOR) {
      throw ApiError.quotaExceeded(
        `Creator storage quota exceeded (${Math.round((currentUsed + newBytes) / 1024 / 1024)} MB / ${Math.round(MEDIA.QUOTA_BYTES_PER_CREATOR / 1024 / 1024)} MB)`
      );
    }
  },

  /**
   * Enforces attachment limits and storage quota atomically inside a transaction with a row lock.
   */
  async createMediaWithLock({
    contentId,
    creatorId,
    kind,
    publicId,
    format,
    bytes,
    width,
    height,
    durationSeconds,
    originalName
  }) {
    const transaction = await sequelize.transaction();

    try {
      // 1. Lock the parent content row (SELECT ... FOR UPDATE)
      const post = await Content.findByPk(contentId, {
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!post) {
        throw ApiError.notFound('Content not found');
      }

      // 2. Count existing attachments for this post under lock
      const currentCount = await Media.count({
        where: { contentId },
        transaction
      });

      if (currentCount >= MEDIA.MAX_PER_POST) {
        throw ApiError.mediaLimit('Media attachment limit reached (maximum 5 attachments per post)');
      }

      // 3. Check total creator quota under lock
      const currentUsed = await Media.sum('bytes', {
        where: { creatorId },
        transaction
      }) || 0;

      if (currentUsed + bytes > MEDIA.QUOTA_BYTES_PER_CREATOR) {
        throw ApiError.quotaExceeded('Creator storage quota exceeded');
      }

      // 4. Insert row with position = currentCount + 1
      const created = await Media.create(
        {
          contentId,
          creatorId,
          kind,
          publicId,
          format,
          bytes,
          width,
          height,
          durationSeconds,
          originalName,
          position: currentCount + 1
        },
        { transaction }
      );

      await transaction.commit();
      return formatMedia(created);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  /**
   * Delete media item by contentId and mediaId.
   */
  async deleteMediaById(contentId, mediaId) {
    const transaction = await sequelize.transaction();
    try {
      const media = await Media.findOne({
        where: { id: mediaId, contentId },
        transaction
      });

      if (!media) {
        await transaction.rollback();
        return null;
      }

      const formatted = formatMedia(media);
      await media.destroy({ transaction });
      await transaction.commit();
      return formatted;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  /**
   * Delete all media items for a content ID (used during post deletion).
   */
  async deleteAllForContent(contentId) {
    const transaction = await sequelize.transaction();
    try {
      const items = await Media.findAll({
        where: { contentId },
        transaction
      });

      const formatted = items.map(formatMedia);
      await Media.destroy({
        where: { contentId },
        transaction
      });

      await transaction.commit();
      return formatted;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};

module.exports = mediaStore;
