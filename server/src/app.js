// Express application assembly (Phase 1 foundation).
// Route -> Middleware -> Validator -> Controller -> Service -> Repository -> Prisma.

const express = require('express');
const morgan = require('morgan');
const { securityMiddleware } = require('./middleware/security');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');
const { serveUploads } = require('./middleware/upload');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  securityMiddleware(app);

  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('short', { stream: { write: (msg) => logger.info(msg.trim()) } }));
  }

  serveUploads(app);

  // ---------- Routes (versioned under /api/v1) ----------
  app.use('/api/v1', require('./routes/health.routes'));
  app.use('/api/v1/auth', require('./routes/auth.routes'));

  // Phase 7: liveness probe (no sensitive data, no database dependency).
  app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Alive', data: { status: 'ok', time: new Date().toISOString() } });
  });

  // Phase 2: tasks/people/followups/dashboard
  app.use('/api/v1/people', require('./routes/people.routes'));
  app.use('/api/v1/tasks', require('./routes/task.routes'));
  app.use('/api/v1/tasks', require('./routes/taskAttachment.routes'));
  app.use('/api/v1/dashboard', require('./routes/dashboard.routes'));

  // Phase 3: search + activity
  app.use('/api/v1/search', require('./routes/search.routes'));
  app.use('/api/v1/activity', require('./routes/activity.routes'));

  // Phase 4: calendar
  app.use('/api/v1/calendar', require('./routes/calendar.routes'));

  // Phase 5: notifications/reminder settings/briefing
  app.use('/api/v1/notifications', require('./routes/notification.routes'));
  app.use('/api/v1/reminder-settings', require('./routes/reminderSetting.routes'));
  app.use('/api/v1/reminders', require('./routes/reminder.routes'));
  app.use('/api/v1/briefing', require('./routes/briefing.routes'));

  // Phase 6: assistant
  app.use('/api/v1/assistant', require('./routes/assistant.routes'));

  // Phase 7: readiness endpoint (MongoDB: ping via runCommand, no SQL on Mongo)
  app.get('/api/ready', async (req, res) => {
    try {
      await require('./config/database').prisma.$runCommandRaw({ ping: 1 });
      return res.json({ success: true, message: 'Ready', data: { ready: true } });
    } catch {
      return res.status(503).json({ success: false, message: 'Database not ready', data: { ready: false } });
    }
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
