'use strict';

const TIERS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'free',
    rank: 0,
    price_cents: 0,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'pro',
    rank: 1,
    price_cents: 500,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'vip',
    rank: 2,
    price_cents: 1500,
    created_at: new Date(),
    updated_at: new Date()
  }
];

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const tier of TIERS) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM tiers WHERE name = :name LIMIT 1`,
        { replacements: { name: tier.name } }
      );

      if (existing.length === 0) {
        await queryInterface.bulkInsert('tiers', [tier]);
      } else {
        await queryInterface.bulkUpdate(
          'tiers',
          {
            rank: tier.rank,
            price_cents: tier.price_cents,
            updated_at: new Date()
          },
          { name: tier.name }
        );
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('tiers', null, {});
  }
};
