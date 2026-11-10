'use strict';

/**
 * Single source of truth for checking if a subscription record is active.
 * Handles camelCase (endsAt) and snake_case (ends_at), Date instances, and ISO strings.
 *
 * @param {Object|null|undefined} sub
 * @param {Date|Object} [nowOption=new Date()] Optional Date, timestamp, or { now } options object
 * @returns {boolean}
 */
const isActiveSubscription = (sub, nowOption = new Date()) => {
  if (!sub || typeof sub !== 'object') {
    return false;
  }

  if (sub.status !== 'active') {
    return false;
  }

  const rawEndsAt = sub.endsAt !== undefined ? sub.endsAt : sub.ends_at;
  if (!rawEndsAt) {
    return true;
  }

  const endsAtDate = rawEndsAt instanceof Date ? rawEndsAt : new Date(rawEndsAt);
  if (Number.isNaN(endsAtDate.getTime())) {
    return false;
  }

  let nowDate = nowOption;
  if (nowOption && typeof nowOption === 'object' && !(nowOption instanceof Date) && nowOption.now) {
    nowDate = nowOption.now;
  }
  const effectiveNow = nowDate instanceof Date ? nowDate : new Date(nowDate);
  const nowMs = Number.isNaN(effectiveNow.getTime()) ? Date.now() : effectiveNow.getTime();

  return endsAtDate.getTime() > nowMs;
};

module.exports = {
  isActiveSubscription
};
