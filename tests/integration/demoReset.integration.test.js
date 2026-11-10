'use strict';

const { resetDb } = require('../helpers/db');
const { createCreator, createSubscriber } = require('../helpers/factories');
const { sequelize, User } = require('../../src/models');
const env = require('../../src/config/env');

describe('Integration: Demo Reset Safety & is_demo Protection', () => {
  beforeEach(async () => {
    await resetDb();
  });

  test('non-demo users (is_demo = false) are never purged during demo reset logic', async () => {
    // 1. Create a non-demo creator and subscriber
    const realCreator = await createCreator({ email: 'real.creator@mycompany.com' });
    const realSubscriber = await createSubscriber({ email: 'real.subscriber@mycompany.com' });

    // Explicitly verify is_demo is false
    const realUsers = await User.findAll({
      where: { email: ['real.creator@mycompany.com', 'real.subscriber@mycompany.com'] }
    });
    expect(realUsers).toHaveLength(2);
    expect(realUsers[0].isDemo).toBe(false);
    expect(realUsers[1].isDemo).toBe(false);

    // 2. Insert a demo user with is_demo = true
    const demoId = '00000000-0000-4000-8000-000000000099';
    await sequelize.query(
      `INSERT INTO users (id, name, email, password_hash, role, is_demo, created_at, updated_at)
       VALUES (:id, 'Demo User', 'demo.user@creatorhub.local', 'hash', 'subscriber', true, NOW(), NOW())`,
      { replacements: { id: demoId } }
    );

    // 3. Execute demo purge transaction
    await sequelize.transaction(async (t) => {
      const demoUsers = await sequelize.query('SELECT id FROM users WHERE is_demo = true', {
        type: sequelize.QueryTypes.SELECT,
        transaction: t
      });
      const demoUserIds = demoUsers.map((u) => u.id);

      if (demoUserIds.length > 0) {
        await sequelize.query('DELETE FROM users WHERE id IN (:demoUserIds)', {
          replacements: { demoUserIds },
          transaction: t
        });
      }
    });

    // 4. Verify demo user was deleted but real users remain intact!
    const remainingDemo = await User.findByPk(demoId);
    expect(remainingDemo).toBeNull();

    const remainingReal = await User.findAll({
      where: { email: ['real.creator@mycompany.com', 'real.subscriber@mycompany.com'] }
    });
    expect(remainingReal).toHaveLength(2);
  });
});
