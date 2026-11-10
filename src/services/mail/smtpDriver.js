'use strict';

const nodemailer = require('nodemailer');
const env = require('../../config/env');

class SmtpDriver {
  constructor() {
    this.transporter = null;
  }

  getTransporter() {
    if (!this.transporter) {
      const options = {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE
      };

      if (env.SMTP_USER && env.SMTP_PASS) {
        options.auth = {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS
        };
      }

      this.transporter = nodemailer.createTransport(options);
    }
    return this.transporter;
  }

  /**
   * Determine if an error is transient or permanent.
   * Transient: connection timeout, DNS, 4xx SMTP codes.
   * Permanent: 5xx SMTP codes, invalid address, authentication failures.
   */
  classifyError(err) {
    if (!err) return false;

    // SMTP response codes: 4xx is transient (e.g., 421, 450, 451, 452)
    if (err.responseCode && err.responseCode >= 400 && err.responseCode < 500) {
      return true;
    }

    // Network & connection errors are transient
    const transientCodes = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ESOCKET', 'ENOTFOUND'];
    if (transientCodes.includes(err.code)) {
      return true;
    }

    return false;
  }

  /**
   * Send an email using SMTP transport.
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
    const transporter = this.getTransporter();

    try {
      const info = await transporter.sendMail({
        from: options.from || env.EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        headers: options.headers || {}
      });

      return {
        messageId: info.messageId,
        accepted: info.accepted || [options.to],
        rejected: info.rejected || []
      };
    } catch (err) {
      err.isTransient = this.classifyError(err);
      throw err;
    }
  }
}

module.exports = new SmtpDriver();
