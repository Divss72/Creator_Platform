/**
 * Resolvers for Comment and CommentAuthor types.
 * Guarantees sensitive user fields (email, passwordHash) are never exposed.
 */
const commentAuthorResolvers = {
  id(parent) {
    return parent.id;
  },
  name(parent) {
    return parent.name || '';
  },
  role(parent) {
    return parent.role || 'subscriber';
  }
};

const commentResolvers = {
  user(parent) {
    return parent.user;
  }
};

module.exports = {
  Comment: commentResolvers,
  CommentAuthor: commentAuthorResolvers
};
