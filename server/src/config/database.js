// Prisma client singleton + connection helpers.

const { PrismaClient } = require('@prisma/client');
const { logger } = require('../utils/logger');

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
});

prisma.$on('warn', (e) => logger.warn('Prisma warning', { message: e.message }));
prisma.$on('error', (e) => logger.error('Prisma error', { message: e.message }));

async function connectDatabase() {
  await prisma.$connect();
  logger.info('Database connected.');
}

async function disconnectDatabase() {
  await prisma.$disconnect();
}

async function checkDatabaseConnection() {
  try {
    // MongoDB connector: ping via runCommand (no SQL/raw queries on Mongo).
    await prisma.$runCommandRaw({ ping: 1 });
    return true;
  } catch (err) {
    logger.error('Database connection check failed', { error: err.message });
    return false;
  }
}

module.exports = { prisma, connectDatabase, disconnectDatabase, checkDatabaseConnection };
