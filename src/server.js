const app = require('./app');
const env = require('./config/env');
const { sequelize } = require('./models');

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('[CreatorHub] Database connection verified successfully.');
  } catch (error) {
    console.error('\n================================================================');
    console.error('[CreatorHub] FATAL: Unable to connect to MySQL database!');
    console.error(`Config: host=${env.DB_HOST}, port=${env.DB_PORT}, db=${env.DB_NAME}, user=${env.DB_USER}`);
    console.error(`Reason: ${error.message}`);
    console.error('\nTroubleshooting Checklist:');
    console.error(' 1. Ensure MySQL service or Docker container is running (e.g. `docker compose up -d`).');
    console.error(' 2. Verify DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD in your .env file.');
    console.error(' 3. Ensure the database exists by running `npm run db:create`.');
    console.error('================================================================\n');
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`[CreatorHub] API server listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`[CreatorHub] Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      try {
        await sequelize.close();
        console.log('[CreatorHub] Database connection closed.');
      } catch (err) {
        console.error('[CreatorHub] Error closing database connection:', err.message);
      }
      console.log('[CreatorHub] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

module.exports = startServer();
