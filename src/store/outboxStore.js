'use strict';

const { Op } = require('sequelize');
const { sequelize, EmailOutbox } = require('../models');

const formatOutboxRow = (instance) => {
  if (!instance) return null;
  const row = instance.get ? instance.get({ plain: true }) : instance;
  return {
    id: row.id,
    type: row.type,
    userId: row.userId,
    toEmail: row.toEmail,
    subject: row.subject,
    html: row.html,
    text: row.text,
    meta: row.meta || {},
    dedupeKey: row.dedupeKey,
    status: row.status,
    attempts: row.attempts,
    nextAttemptAt: row.nextAttemptAt,
    lastError: row.lastError,
    skipReason: row.skipReason,
    sentAt: row.sentAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
};

const outboxStore = {
  /**
   * Enqueue an email into the outbox.
   * Deduplication guarantee: returns { enqueued: false, duplicate: true } if dedupeKey exists.
   *
   * @param {Object} item
   * @returns {Promise<{ enqueued: boolean, duplicate?: boolean, row: Object }>}
   */
  async enqueue(item) {
    try {
      const row = await EmailOutbox.create({
        type: item.type,
        userId: item.userId,
        toEmail: item.toEmail.toLowerCase().trim(),
        subject: item.subject,
        html: item.html,
        text: item.text,
        meta: item.meta || {},
        dedupeKey: item.dedupeKey,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: item.nextAttemptAt || null
      });

      return {
        enqueued: true,
        duplicate: false,
        row: formatOutboxRow(row)
      };
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        const existing = await EmailOutbox.findOne({
          where: { dedupeKey: item.dedupeKey }
        });
        return {
          enqueued: false,
          duplicate: true,
          row: formatOutboxRow(existing)
        };
      }
      throw err;
    }
  },

  /**
   * Concurrency-safe claim of due outbox rows using SELECT ... FOR UPDATE SKIP LOCKED.
   * Atomically transitions claimed rows from 'pending' to 'sending'.
   *
   * @param {Object} options
   * @param {number} [options.batchSize=50]
   * @returns {Promise<Object[]>}
   */
  async claimDueRows({ batchSize = 50 } = {}) {
    const transaction = await sequelize.transaction();

    try {
      const now = new Date();

      const rows = await EmailOutbox.findAll({
        where: {
          status: 'pending',
          [Op.or]: [
            { nextAttemptAt: null },
            { nextAttemptAt: { [Op.lte]: now } }
          ]
        },
        order: [['id', 'ASC']],
        limit: batchSize,
        transaction,
        lock: transaction.LOCK.UPDATE,
        skipLocked: true
      });

      if (rows.length === 0) {
        await transaction.commit();
        return [];
      }

      const ids = rows.map((r) => r.id);
      await EmailOutbox.update(
        { status: 'sending' },
        {
          where: { id: { [Op.in]: ids } },
          transaction
        }
      );

      await transaction.commit();
      return rows.map(formatOutboxRow);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  /**
   * Mark an outbox row as successfully sent.
   */
  async markSent(id, { messageId } = {}) {
    await EmailOutbox.update(
      {
        status: 'sent',
        sentAt: new Date(),
        lastError: null
      },
      { where: { id } }
    );
  },

  /**
   * Mark an outbox row as failed or re-schedule for transient retry.
   */
  async markFailed(id, { error, isTransient, nextAttemptAt, maxAttempts = 5 }) {
    const row = await EmailOutbox.findByPk(id);
    if (!row) return;

    const currentAttempts = (row.attempts || 0) + 1;
    const safeError = String(error?.message || error || 'Unknown error').slice(0, 500);

    if (isTransient && currentAttempts < maxAttempts) {
      await row.update({
        attempts: currentAttempts,
        status: 'pending',
        nextAttemptAt: nextAttemptAt || new Date(Date.now() + 60 * 1000),
        lastError: safeError
      });
    } else {
      await row.update({
        attempts: currentAttempts,
        status: 'failed',
        lastError: safeError
      });
    }
  },

  /**
   * Mark an outbox row as skipped (e.g. User unsubscribed or lost access).
   */
  async markSkipped(id, { reason }) {
    await EmailOutbox.update(
      {
        status: 'skipped',
        skipReason: String(reason || 'skipped').slice(0, 100)
      },
      { where: { id } }
    );
  },

  /**
   * Reclaim rows stuck in 'sending' state (e.g. Worker crashed).
   * Resets status back to 'pending'.
   */
  async reclaimStuckRows(stuckThresholdMs = 5 * 60 * 1000) {
    const seconds = Math.ceil(stuckThresholdMs / 1000);

    const [result] = await sequelize.query(
      `UPDATE email_outbox
       SET status = 'pending'
       WHERE status = 'sending'
         AND updated_at <= DATE_SUB(NOW(), INTERVAL :seconds SECOND)`,
      {
        replacements: { seconds }
      }
    );

    return result?.affectedRows !== undefined ? result.affectedRows : result;
  },

  /**
   * Count outbox rows grouped by status.
   */
  async countByStatus() {
    const counts = {
      pending: 0,
      sending: 0,
      sent: 0,
      failed: 0,
      skipped: 0
    };

    const rows = await EmailOutbox.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status'],
      raw: true
    });

    for (const r of rows) {
      if (r.status in counts) {
        counts[r.status] = parseInt(r.count, 10) || 0;
      }
    }

    return counts;
  },

  /**
   * Count sent emails for a recipient in the last 24 hours.
   */
  async countByRecipientLast24h(toEmail) {
    if (!toEmail) return 0;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return EmailOutbox.count({
      where: {
        toEmail: toEmail.toLowerCase().trim(),
        status: 'sent',
        sentAt: { [Op.gte]: since }
      }
    });
  },

  /**
   * Delete old sent and failed outbox rows.
   */
  async purgeOld({ sentRetentionDays = 30, failedRetentionDays = 60 } = {}) {
    const sentCutoff = new Date(Date.now() - sentRetentionDays * 24 * 60 * 60 * 1000);
    const failedCutoff = new Date(Date.now() - failedRetentionDays * 24 * 60 * 60 * 1000);

    const deletedSent = await EmailOutbox.destroy({
      where: {
        status: 'sent',
        sentAt: { [Op.lte]: sentCutoff }
      }
    });

    const deletedFailed = await EmailOutbox.destroy({
      where: {
        status: { [Op.in]: ['failed', 'skipped'] },
        updatedAt: { [Op.lte]: failedCutoff }
      }
    });

    return { deletedSent, deletedFailed };
  }
};

module.exports = outboxStore;
