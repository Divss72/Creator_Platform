'use strict';

/**
 * Pure mathematical functions for subscription analytics rollups, deltas, and period metrics.
 */

/**
 * Applies a list of subscription events on a specific day to compute tier deltas and flow totals.
 *
 * @param {Array<Object>} events
 * @param {Map<string, string>} tierIdToName Map of tier ID -> normalized tier name ('free', 'pro', 'vip')
 * @returns {{ deltas: { free: number, pro: number, vip: number, total: number }, newSubscribers: number, cancellations: number }}
 */
function computeDailyEventDeltas(events = [], tierIdToName = new Map()) {
  const deltas = { free: 0, pro: 0, vip: 0, total: 0 };
  let newSubscribers = 0;
  let cancellations = 0;

  for (const event of events) {
    const fromName = event.fromTierId ? tierIdToName.get(event.fromTierId) : null;
    const toName = event.toTierId ? tierIdToName.get(event.toTierId) : null;

    switch (event.event) {
      case 'created':
      case 'reactivated':
        newSubscribers++;
        if (toName && deltas[toName] !== undefined) {
          deltas[toName] += 1;
        }
        deltas.total += 1;
        break;

      case 'cancelled':
        cancellations++;
        if (fromName && deltas[fromName] !== undefined) {
          deltas[fromName] -= 1;
        }
        deltas.total -= 1;
        break;

      case 'tier_changed':
        if (fromName && deltas[fromName] !== undefined) {
          deltas[fromName] -= 1;
        }
        if (toName && deltas[toName] !== undefined) {
          deltas[toName] += 1;
        }
        // Total active count remains unchanged on tier change
        break;

      default:
        break;
    }
  }

  return { deltas, newSubscribers, cancellations };
}

/**
 * Carries forward previous day's stock with today's deltas. Clamps to zero to guard against negative artifacts.
 */
function applyStockDeltas(
  prevStock = { free: 0, pro: 0, vip: 0, total: 0 },
  deltas = { free: 0, pro: 0, vip: 0, total: 0 }
) {
  const free = Math.max(0, (prevStock.free || 0) + (deltas.free || 0));
  const pro = Math.max(0, (prevStock.pro || 0) + (deltas.pro || 0));
  const vip = Math.max(0, (prevStock.vip || 0) + (deltas.vip || 0));
  const total = free + pro + vip;

  return { free, pro, vip, total };
}

/**
 * Calculates estimated MRR in cents from active subscriber tier counts and current tier prices.
 *
 * @param {Object} byTier { free: number, pro: number, vip: number }
 * @param {Object} tierPrices { free: number, pro: number, vip: number } in cents
 * @returns {number}
 */
function calculateEstimatedMrrCents(byTier = {}, tierPrices = { free: 0, pro: 1500, vip: 5000 }) {
  const proCount = Math.max(0, Number(byTier.pro) || 0);
  const vipCount = Math.max(0, Number(byTier.vip) || 0);

  const proPrice = Number(tierPrices.pro) || 0;
  const vipPrice = Number(tierPrices.vip) || 0;

  return proCount * proPrice + vipCount * vipPrice;
}

/**
 * Calculates percentage change between previous and current period values.
 * Returns null if previous value is 0 or undefined.
 */
function calculateChangePct(current, previous) {
  const prevNum = Number(previous);
  const currNum = Number(current);

  if (!Number.isFinite(prevNum) || prevNum === 0 || !Number.isFinite(currNum)) {
    return null;
  }

  const change = ((currNum - prevNum) / Math.abs(prevNum)) * 100;
  return Math.round(change * 10) / 10;
}

/**
 * Calculates period churn rate.
 * Formula: cancellations / active_at_start
 * Returns null if active_at_start is 0 or not positive.
 */
function calculateChurnRate(cancellations, activeAtStart) {
  const cancelNum = Math.max(0, Number(cancellations) || 0);
  const startNum = Number(activeAtStart);

  if (!Number.isFinite(startNum) || startNum <= 0) {
    return null;
  }

  const rate = cancelNum / startNum;
  return Math.round(rate * 1000) / 1000;
}

module.exports = {
  computeDailyEventDeltas,
  applyStockDeltas,
  calculateEstimatedMrrCents,
  calculateChangePct,
  calculateChurnRate
};
