const crypto = require('crypto');

/**
 * Mock payment processor service.
 * Always succeeds for simulating subscription purchases, upgrades, and renewals.
 */
const mockPaymentService = {
  /**
   * Process a mock payment transaction
   * @param {Object} params
   * @param {string} params.subscriberId
   * @param {string} params.creatorId
   * @param {string} params.tier
   * @param {number} params.priceCents
   * @returns {Promise<{ success: boolean, transactionId: string }>}
   */
  async processPayment({ subscriberId, creatorId, tier, priceCents = 0 }) {
    // TODO(future): Replace mock payment with real payment gateway provider (e.g. Stripe, LemonSqueezy)
    // Never integrate real payments during development/demo phases.
    return {
      success: true,
      transactionId: `mock_tx_${crypto.randomUUID()}`,
      timestamp: new Date()
    };
  }
};

module.exports = mockPaymentService;
