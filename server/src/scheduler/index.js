// In-process scheduler for the reminder engine.
// - Non-blocking (runs outside request handling)
// - Idempotent ticks (notification dedupe keys prevent duplicates)
// - Safe to restart; nothing is lost if a tick is missed.

const { prisma } = require('../config/database');
const { reminderService } = require('../services/reminder.service');
const { logger } = require('../utils/logger');

const TICK_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
let timer = null;

async function tick() {
  try {
    const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
    for (const user of users) {
      const results = await reminderService.runSchedulerTick(user.id);
      if (Object.values(results).some((n) => n > 0)) {
        logger.debug('Reminder tick processed', { userId: user.id, ...results });
      }
    }
  } catch (err) {
    logger.error('Scheduler tick error', { error: err.message });
  }
}

const scheduler = {
  start() {
    if (timer) return;
    // Run first tick shortly after boot so reminders exist quickly.
    timer = setInterval(tick, TICK_INTERVAL_MS);
    timer.unref?.();
    logger.info('Reminder scheduler started (interval 5m).');
    setTimeout(tick, 5000).unref?.();
  },
  stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
      logger.info('Reminder scheduler stopped.');
    }
  },
  async runOnce() {
    return tick();
  },
};

module.exports = { scheduler };
