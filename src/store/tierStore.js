const { Tier } = require('../models');

let cachedTiers = null;
let lastFetchTime = 0;
const CACHE_TTL = 60000; // 1 minute in-memory cache

async function loadTiers(force = false) {
  const now = Date.now();
  if (!force && cachedTiers && now - lastFetchTime < CACHE_TTL) {
    return cachedTiers;
  }

  const tiers = await Tier.findAll({
    order: [['rank', 'ASC']]
  });

  cachedTiers = tiers.map((t) => t.get({ plain: true }));
  lastFetchTime = now;
  return cachedTiers;
}

const tierStore = {
  /**
   * Get all tiers ordered by rank ascending
   */
  async findAll() {
    return loadTiers();
  },

  /**
   * Find tier by name ('free', 'pro', 'vip')
   */
  async getByName(name) {
    if (!name) return null;
    const tiers = await loadTiers();
    const normalized = name.toLowerCase().trim();
    return tiers.find((t) => t.name === normalized) || null;
  },

  /**
   * Find tier by ID
   */
  async getById(id) {
    if (!id) return null;
    const tiers = await loadTiers();
    return tiers.find((t) => t.id === id) || null;
  },

  /**
   * Clear in-memory cache
   */
  clearCache() {
    cachedTiers = null;
    lastFetchTime = 0;
  }
};

module.exports = tierStore;
