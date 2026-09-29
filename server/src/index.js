// Executive PA - Server entrypoint
// Boots the Express app, applies startup environment validation and
// handles graceful shutdown (Phase 7 hardening).

const { createApp } = require('./app');
const { env: config, validateEnvironment } = require('./config/env');
const { connectDatabase, disconnectDatabase, checkDatabaseConnection } = require('./config/database');
const { scheduler } = require('./scheduler');
const { logger } = require('./utils/logger');

async function main() {
  // PaaS-resilient startup: NEVER exit(1) for DB issues. Boot always; if the
  // DB is unreachable at boot, run degraded (health stays green) and let
  // Prisma's per-query lazy reconnecting pick up the DB once credentials or
  // network are fixed - no redeploy needed.
  const envResult = validateEnvironment();
  const dbConfigured = Boolean(config.DATABASE_URL);
  if (!envResult.ok && dbConfigured) {
    logger.error('Startup aborted: invalid environment configuration', { issues: envResult.issues });
    process.exit(1);
  }

  let dbConnected = false;
  if (!dbConfigured) {
    logger.warn('DATABASE_URL is not set - running in DEGRADED mode (no database). Set DATABASE_URL to enable data features.', { issues: envResult.issues });
  } else {
    dbConnected = await checkDatabaseConnection();
    if (dbConnected) {
      await connectDatabase();
    } else {
      logger.warn('Database unreachable at boot - running DEGRADED. Prisma will reconnect automatically once the database is reachable; no redeploy required.');
    }
  }

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info(`Executive PA API listening on port ${config.PORT} (${config.NODE_ENV})`);
  });

  // Railway's Docker-deploy proxy defaults to dialing port 8080 when no target
  // port is set on the domain. Listen there too so the public domain always
  // reaches the app regardless of which port Railway chose.
  let extraServer = null;
  if (config.PORT !== 8080) {
    extraServer = app.listen(8080, () => {
      logger.info('Secondary listener on port 8080 (PaaS proxy compatibility).');
    });
  }

  // Reminder engine: start only in long-running server mode, never in tests,
  // and only when the database was reachable at boot.
  if (config.NODE_ENV !== 'test' && dbConnected) {
    scheduler.start();
  }

  // ---- Graceful shutdown -------------------------------------------------
  const shutdown = async (signal) => {
    logger.info(`${signal} received; shutting down gracefully...`);
    scheduler.stop();
    if (extraServer) extraServer.close();
    server.close(async () => {
      try {
        if (dbConnected) await disconnectDatabase();
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
