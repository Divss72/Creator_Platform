const tierStore = require('../store/tierStore');

/**
 * Public endpoint to list platform tiers
 * Returns: [{ name, rank, priceCents }]
 */
const listTiers = async (req, res) => {
  const tiers = await tierStore.findAll();

  const formattedTiers = tiers.map((tier) => ({
    name: tier.name,
    rank: tier.rank,
    priceCents: tier.priceCents
  }));

  res.status(200).json(formattedTiers);
};

module.exports = {
  listTiers
};
