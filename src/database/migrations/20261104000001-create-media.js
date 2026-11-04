'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('media', {
      id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false
      },
      content_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: {
          model: 'content',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      creator_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      kind: {
        type: Sequelize.ENUM('image', 'video'),
        allowNull: false
      },
      public_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      format: {
        type: Sequelize.STRING(32),
        allowNull: false
      },
      bytes: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false
      },
      width: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true
      },
      height: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true
      },
      duration_seconds: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      original_name: {
        type: Sequelize.STRING(150),
        allowNull: false
      },
      position: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Composite index: (content_id, position)
    await queryInterface.addIndex('media', ['content_id', 'position'], {
      name: 'idx_media_content_position'
    });

    // Index: (creator_id) for fast quota computation
    await queryInterface.addIndex('media', ['creator_id'], {
      name: 'idx_media_creator_id'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('media');
  }
};
