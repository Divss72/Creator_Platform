const { userStore } = require('../store');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');
const ApiError = require('../utils/apiError');

/**
 * Register a new user (creator or subscriber)
 */
const register = async (req, res) => {
  const { name, email, password, role } = req.body;

  const existingUser = await userStore.findByEmail(email);
  if (existingUser) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const passwordHash = await hashPassword(password);
  const user = await userStore.create({
    name,
    email,
    passwordHash,
    role,
    displayName: name
  });

  const token = generateToken({
    sub: user.id,
    role: user.role
  });

  res.status(201).json({
    token,
    user: userStore.sanitize(user)
  });
};

/**
 * Log in an existing user
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await userStore.findByEmail(email);
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const token = generateToken({
    sub: user.id,
    role: user.role
  });

  res.status(200).json({
    token,
    user: userStore.sanitize(user)
  });
};

/**
 * Get current authenticated user profile
 */
const getMe = async (req, res) => {
  // req.user is attached and sanitized by requireAuth middleware
  res.status(200).json({
    user: req.user
  });
};

module.exports = {
  register,
  login,
  getMe
};
