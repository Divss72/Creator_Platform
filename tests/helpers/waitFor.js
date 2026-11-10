'use strict';

/**
 * Poll an asynchronous predicate until it returns truthy, or timeout.
 * Replaces arbitrary sleeps in tests.
 *
 * @param {Function} predicate
 * @param {Object} [options]
 * @param {number} [options.timeout=5000]
 * @param {number} [options.interval=50]
 * @returns {Promise<any>}
 */
async function waitFor(predicate, { timeout = 5000, interval = 50 } = {}) {
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeout) {
    try {
      const result = await predicate();
      if (result) {
        return result;
      }
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  const errorMsg = lastError ? ` (Last error: ${lastError.message})` : '';
  throw new Error(`waitFor predicate timed out after ${timeout}ms${errorMsg}`);
}

module.exports = { waitFor };

