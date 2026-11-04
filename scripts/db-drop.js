const mysql = require('mysql2/promise');
const env = require('../src/config/env');

async function dropDatabase() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD
    });

    console.log(`[db:drop] Connected to MySQL at ${env.DB_HOST}:${env.DB_PORT}`);
    await connection.query(`DROP DATABASE IF EXISTS \`${env.DB_NAME}\`;`);
    console.log(`[db:drop] Database '${env.DB_NAME}' dropped successfully.`);
  } catch (err) {
    console.error(`[db:drop] Failed to drop database '${env.DB_NAME}':`, err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

dropDatabase();
