'use strict';

/**
 * Pure trending score calculation.
 * Formula: (wV * views + wC * commenters + wL * likes) / (ageHours + 2) ^ gravity
 *
 * @param {Object} metrics
 * @param {number} [metrics.views=0] Total lifetime views (unlocked + locked)
 * @param {number} [metrics.commenters=0] Distinct non-owner commenters
 * @param {number} [metrics.likes=0] Active reactions
 * @param {number} [metrics.ageHours=0] Age of post in hours
 * @param {Object} [config={}]
 * @param {number} [config.weightViews=1]
 * @param {number} [config.weightComments=2]
 * @param {number} [config.weightLikes=3]
 * @param {number} [config.gravity=1.5]
 * @returns {number}
 */
function calculateTrendingScore(metrics = {}, config = {}) {
  const views = Math.max(0, Number(metrics.views) || 0);
  const commenters = Math.max(0, Number(metrics.commenters) || 0);
  const likes = Math.max(0, Number(metrics.likes) || 0);
  const rawAge = Number(metrics.ageHours) || 0;
  const ageHours = Math.max(0, rawAge);

  const wV = config.weightViews !== undefined ? Number(config.weightViews) : 1;
  const wC = config.weightComments !== undefined ? Number(config.weightComments) : 2;
  const wL = config.weightLikes !== undefined ? Number(config.weightLikes) : 3;
  const gravity = config.gravity !== undefined ? Number(config.gravity) : 1.5;

  const numerator = wV * views + wC * commenters + wL * likes;
  if (numerator <= 0) {
    return 0;
  }

  const denominator = Math.pow(ageHours + 2, gravity);
  if (denominator <= 0) {
    return 0;
  }

  const score = numerator / denominator;
  return Number.isFinite(score) ? score : 0;
}

module.exports = { calculateTrendingScore };
