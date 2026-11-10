'use strict';

/**
 * Migration: Add notification preferences to users table.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'notify_new_posts', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });

    await queryInterface.addColumn('users', 'notify_weekly_digest', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'notify_weekly_digest');
    await queryInterface.removeColumn('users', 'notify_new_posts');
  }
};
