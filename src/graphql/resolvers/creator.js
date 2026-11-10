'use strict';

/**
 * Resolvers for Creator type.
 * Guarantees sensitive user fields (email, passwordHash) are never exposed.
 */
const creatorResolvers = {
  id(parent) {
    return parent.id;
  },
  displayName(parent) {
    return parent.displayName || parent.name || '';
  },
  bio(parent) {
    return parent.bio || null;
  },
  avatarUrl(parent) {
    return parent.avatarUrl || null;
  }
};

module.exports = {
  Creator: creatorResolvers
};
