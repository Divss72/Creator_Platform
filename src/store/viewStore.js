'use strict';

const { sequelize } = require('../models');

const viewStore = {
  /**
   * Records a view with daily deduplication and incremental daily rollups in a single transaction.
   *
   * @param {Object} params
   * @param {string} params.contentId
   * @param {string} params.viewerKey
   * @param {string} params.day YYYY-MM-DD
   * @param {boolean} params.isLocked
   * @returns {Promise<{ recorded: boolean }>}
   */
  async recordView({ contentId, viewerKey, day, isLocked = false }) {
    const transaction = await sequelize.transaction();

    try {
      // 1. INSERT IGNORE into content_view_dedupe
      const [insertResult, metadata] = await sequelize.query(
        `INSERT IGNORE INTO content_view_dedupe (content_id, viewer_key, day)
         VALUES (:contentId, :viewerKey, :day)`,
        {
          replacements: { contentId, viewerKey, day },
          transaction
        }
      );

      // In MySQL with Sequelize, affectedRows is in ResultSetHeader
      const affected =
        insertResult && insertResult.affectedRows !== undefined
          ? insertResult.affectedRows
          : metadata && metadata.affectedRows !== undefined
            ? metadata.affectedRows
            : typeof insertResult === 'number'
              ? insertResult
              : 0;

      const isNew = affected > 0;

      if (!isNew) {
        // Repeat view by same viewer on same day: commit dedupe check and return
        await transaction.commit();
        return { recorded: false };
      }

      // 2. Only if newly inserted, upsert into content_daily_stats
      const viewsIncrement = 1;
      const lockedIncrement = isLocked ? 1 : 0;

      await sequelize.query(
        `INSERT INTO content_daily_stats (content_id, day, views, locked_views)
         VALUES (:contentId, :day, :viewsIncrement, :lockedIncrement)
         ON DUPLICATE KEY UPDATE
           views = views + VALUES(views),
           locked_views = locked_views + VALUES(locked_views)`,
        {
          replacements: { contentId, day, viewsIncrement, lockedIncrement },
          transaction
        }
      );

      await transaction.commit();
      return { recorded: true };
    } catch (err) {
      if (transaction && !transaction.finished) {
        try {
          await transaction.rollback();
        } catch (_rb) {}
      }
      throw err;
    }
  },

  /**
   * Purges old raw deduplication rows older than retention days (default 3 days).
   * Daily aggregate counts remain preserved in content_daily_stats.
   *
   * @param {number} [retentionDays=3]
   * @returns {Promise<number>} Count of deleted rows
   */
  async purgeOldDedupe(retentionDays = 3) {
    const cutoffDate = new Date(Date.now() - retentionDays * 86400000);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    const [result] = await sequelize.query(
      'DELETE FROM content_view_dedupe WHERE day < :cutoffStr',
      {
        replacements: { cutoffStr }
      }
    );

    return result && result.affectedRows ? result.affectedRows : 0;
  }
};

module.exports = viewStore;
