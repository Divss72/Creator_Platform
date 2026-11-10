/**
 * Single source of truth for checking if a subscription record is active.
 * Handles camelCase (endsAt) and snake_case (ends_at), Date instances, and ISO strings.
 *
 * @param {Object|null|undefined} sub
 * @param {Date} [now]
 * @returns {boolean}
 */
const isActiveSubscription = (sub, now = new Date()) => {
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

  return endsAtDate.getTime() > now.getTime();
};

module.exports = {
  isActiveSubscription
};
