'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('creator_profiles', 'avatar_public_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('creator_profiles', 'avatar_public_id');
  }
};
