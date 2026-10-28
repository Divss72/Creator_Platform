const crypto = require('crypto');

// In-memory store holding user records
const users = [];

const sanitize = (user) => {
  if (!user) return null;
  // Never leak password hashes
  const { passwordHash, ...safeUser } = user;
  return safeUser;
};

const userStore = {
  /**
   * Create a new user record
   */
  async create({ name, email, passwordHash, role, displayName, bio = '' }) {
    const now = new Date();
    const newUser = {
      id: crypto.randomUUID(),
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
      role,
      displayName: displayName || name,
      bio: bio || '',
      createdAt: now,
      updatedAt: now
    };

    users.push(newUser);
    return { ...newUser };
  },

  /**
   * Find a user by email address (case-insensitive)
   */
  async findByEmail(email) {
    if (!email) return null;
    const normalized = email.toLowerCase().trim();
    const user = users.find((u) => u.email === normalized);
    return user ? { ...user } : null;
  },

  /**
   * Find a user by ID
   */
  async findById(id) {
    const user = users.find((u) => u.id === id);
    return user ? { ...user } : null;
  },

  /**
   * Update an existing user's profile
   */
  async update(id, updates) {
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) return null;

    const current = users[index];
    const allowedFields = ['name', 'displayName', 'bio'];
    const filteredUpdates = {};

    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    const updatedUser = {
      ...current,
      ...filteredUpdates,
      updatedAt: new Date()
    };

    users[index] = updatedUser;
    return { ...updatedUser };
  },

  /**
   * Helper to strip sensitive data
   */
  sanitize,

  /**
   * Reset store (used for tests)
   */
  async reset() {
    users.length = 0;
  }
};

module.exports = userStore;
