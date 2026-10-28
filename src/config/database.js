const { Sequelize } = require('sequelize');
const env = require('./env');

const config = {
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: 'mysql',
  logging: env.DB_LOGGING ? console.log : false,
  define: {
    timestamps: true,
    underscored: true
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  port: config.port,
  dialect: config.dialect,
  logging: config.logging,
  define: config.define,
  pool: config.pool
});

module.exports = {
  development: config,
  test: config,
  production: config,
  sequelize
};
