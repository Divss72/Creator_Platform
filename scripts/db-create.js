const mysql = require('mysql2/promise');
const env = require('../src/config/env');

async function createDatabase() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD
    });

    console.log(`[db:create] Connected to MySQL at ${env.DB_HOST}:${env.DB_PORT}`);
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    console.log(`[db:create] Database '${env.DB_NAME}' created or verified successfully.`);
  } catch (err) {
    console.error(`[db:create] Failed to create database '${env.DB_NAME}':`, err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

createDatabase();
