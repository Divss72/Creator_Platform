'use strict';

const crypto = require('crypto');

/**
 * Mask an email address for privacy in logs.
 * e.g., 'alice@example.com' -> 'al***@example.com'
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '***';
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}***@${domain}`;
}

class LogDriver {
  constructor() {
    this.buffer = [];
    this.maxBufferSize = 100;
    this.failNextCount = 0;
    this.failAll = false;
  }

  /**
   * Reset internal state
   */
  clear() {
    this.buffer = [];
    this.failNextCount = 0;
    this.failAll = false;
  }

  /**
   * Simulate failure for the next N sends
   * @param {number} [count=1]
   */
  simulateFailNext(count = 1) {
    this.failNextCount = Math.max(0, count);
  }

  /**
   * Simulate failure for all subsequent sends
   * @param {boolean} [fail=true]
   */
  simulateFailAll(fail = true) {
    this.failAll = Boolean(fail);
  }

  /**
   * Get all sent messages
   */
  getSent() {
    return [...this.buffer];
  }

  /**
   * Get all messages sent to a specific recipient
   */
  getSentTo(email) {
    if (!email) return [];
    const normalized = email.toLowerCase().trim();
    return this.buffer.filter((msg) => msg.to && msg.to.toLowerCase().trim() === normalized);
  }

  /**
   * Send an email (mocked log driver)
   * @param {Object} options
   * @param {string} options.to
   * @param {string} options.from
   * @param {string} options.subject
   * @param {string} [options.html]
   * @param {string} [options.text]
   * @param {Object} [options.headers]
   * @returns {Promise<{ messageId: string, accepted: string[], rejected: string[] }>}
   */
  async send(options) {
    if (this.failAll) {
      const err = new Error('Simulated mail failure (fail-all)');
      err.isTransient = true;
      throw err;
    }

    if (this.failNextCount > 0) {
      this.failNextCount--;
      const err = new Error('Simulated mail failure (fail-next)');
      err.isTransient = true;
      throw err;
    }

    const messageId = `<${crypto.randomUUID()}@creatorhub.local>`;
    const sentRecord = {
      messageId,
      to: options.to,
      from: options.from,
      subject: options.subject,
      html: options.html,
      text: options.text,
      headers: options.headers || {},
      sentAt: new Date().toISOString()
    };

    this.buffer.push(sentRecord);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    console.log(
      `[MailLog] Sent email id=${messageId} to=${maskEmail(options.to)} subject="${options.subject}"`
    );

    return {
      messageId,
      accepted: [options.to],
      rejected: []
    };
  }
}

module.exports = new LogDriver();
