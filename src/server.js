'use strict';

const { bootstrap } = require('./bootstrap');

async function start() {
  try {
    const instance = await bootstrap();

    const shutdown = async (signal) => {
      console.log(`[CreatorHub] Received ${signal}. Shutting down gracefully...`);
      try {
        await instance.close();
        console.log('[CreatorHub] Clean shutdown complete.');
        process.exit(0);
      } catch (err) {
        console.error('[CreatorHub] Error during shutdown:', err.message);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return instance.httpServer;
  } catch (error) {
    console.error('[CreatorHub] Fatal boot error:', error.message);
    process.exit(1);
  }
}

module.exports = start();
