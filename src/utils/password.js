const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

/**
 * Hash a plain text password using bcrypt
 */
const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare plain text password against hashed password
 */
const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

module.exports = {
  hashPassword,
  comparePassword
};
