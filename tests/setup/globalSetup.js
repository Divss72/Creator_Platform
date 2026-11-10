'use strict';

const mysql = require('mysql2/promise');
const { execSync } = require('child_process');
const env = require('../../src/config/env');

module.exports = async function globalSetup() {
  const dbName = process.env.DB_NAME_TEST || env.DB_NAME_TEST || 'creatorhub_test';

  if (!dbName.endsWith('_test') || process.env.NODE_ENV !== 'test') {
    throw new Error(
      `FATAL: Tests may only run when NODE_ENV=test and the database name ends with '_test' (current DB: "${dbName}", NODE_ENV: "${process.env.NODE_ENV}")`
    );
  }

  // 1. Ensure test database exists
  let connection;
  try {
    connection = await mysql.createConnection({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
  } catch (err) {
    if (connection) await connection.end();
    // Fallback to root if regular user doesn't have CREATE DATABASE permission
    try {
      connection = await mysql.createConnection({
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: 'root',
        password: process.env.DB_ROOT_PASSWORD || 'rootpassword'
      });
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
      await connection.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${env.DB_USER}'@'%';`);
      await connection.query('FLUSH PRIVILEGES;');
    } catch (rootErr) {
      console.warn('[globalSetup] Note: could not ensure DB via root:', rootErr.message);
    }
  } finally {
    if (connection) await connection.end();
  }

  // 2. Run migrations and reference tier seed on the test database
  const runEnv = {
    ...process.env,
    NODE_ENV: 'test',
    DB_NAME: dbName
  };

  try {
    execSync('npx sequelize-cli db:migrate', {
      env: runEnv,
      stdio: 'pipe'
    });
    execSync('npx sequelize-cli db:seed --seed 20261028000001-seed-tiers.js', {
      env: runEnv,
      stdio: 'pipe'
    });
  } catch (err) {
    console.error('[globalSetup] Error running migrations/seeds on test DB:', err.stdout?.toString() || err.message);
    throw err;
  }
};
