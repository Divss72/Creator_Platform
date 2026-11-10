'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add is_demo column to users table
    await queryInterface.addColumn('users', 'is_demo', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // 2. Idempotent backfill of historical subscription_events from existing subscriptions
    try {
      const subscriptions = await queryInterface.sequelize.query(
        'SELECT subscriber_id, creator_id, tier_id, status, started_at, ends_at, updated_at FROM subscriptions',
        { type: Sequelize.QueryTypes.SELECT }
      );

      if (subscriptions && subscriptions.length > 0) {
        const events = [];
        for (const sub of subscriptions) {
          // Created event
          events.push({
            subscriber_id: sub.subscriber_id,
            creator_id: sub.creator_id,
            event: 'created',
            from_tier_id: null,
            to_tier_id: sub.tier_id,
            created_at: sub.started_at || new Date()
          });

          // If cancelled, add cancelled event
          if (sub.status === 'cancelled') {
            events.push({
              subscriber_id: sub.subscriber_id,
              creator_id: sub.creator_id,
              event: 'cancelled',
              from_tier_id: sub.tier_id,
              to_tier_id: null,
              created_at: sub.ends_at || sub.updated_at || new Date()
            });
          }
        }

        if (events.length > 0) {
          await queryInterface.bulkInsert('subscription_events', events);
        }
      }
    } catch (err) {
      console.warn(
        '[Migration backfill] Note: subscription_events backfill skipped or non-fatal:',
        err.message
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'is_demo');
  }
};
