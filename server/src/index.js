// Executive PA - Server entrypoint
// Boots the Express app, applies startup environment validation and
// handles graceful shutdown (Phase 7 hardening).

const { createApp } = require('./app');
const { env: config, validateEnvironment } = require('./config/env');
const { connectDatabase, disconnectDatabase, checkDatabaseConnection } = require('./config/database');
const { scheduler } = require('./scheduler');
const { logger } = require('./utils/logger');

async function main() {
  // Fail fast on malformed config, but tolerate a missing DATABASE_URL by
  // starting in degraded mode: the API serves /api/health and non-DB routes
  // while DB-backed endpoints return errors until DATABASE_URL is provided.
  // This keeps PaaS deploys green (no crash/retry loop) during setup.
  const envResult = validateEnvironment();
  const dbConfigured = Boolean(config.DATABASE_URL);
  if (!envResult.ok && dbConfigured) {
    logger.error('Startup aborted: invalid environment configuration', { issues: envResult.issues });
    process.exit(1);
  }

  if (!dbConfigured) {
    logger.warn('DATABASE_URL is not set - starting in DEGRADED mode (no database). Set DATABASE_URL and redeploy to enable data features.', { issues: envResult.issues });
  } else {
    const dbOk = await checkDatabaseConnection();
    if (!dbOk) {
      logger.error('Startup aborted: could not connect to MongoDB. Check DATABASE_URL.');
      process.exit(1);
    }

    await connectDatabase();
  }

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info(`Executive PA API listening on port ${config.PORT} (${config.NODE_ENV})`);
  });

  // Reminder engine: start only in long-running server mode, never in tests,
  // and only when a database is configured.
  if (config.NODE_ENV !== 'test' && dbConfigured) {
    scheduler.start();
  }

  // ---- Graceful shutdown -------------------------------------------------
  const shutdown = async (signal) => {
    logger.info(`${signal} received; shutting down gracefully...`);
    scheduler.stop();
    server.close(async () => {
      try {
        if (dbConfigured) await disconnectDatabase();
        logger.info('Shutdown complete.');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown', { error: err.message });
        process.exit(1);
      }
    });
    // Force-exit safety valve.
    setTimeout(() => {
      logger.warn('Forcing shutdown after timeout.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: err.message });
  process.exit(1);
});
