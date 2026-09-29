// Security middleware: Helmet, CORS, rate limiting, request-size limits.

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');

// On PaaS (Railway) the client gets an auto-generated *.up.railway.app domain
// that isn't known at API boot. Allow any such origin when running on PaaS -
// safe here because this is a private single-user app gated by password auth.
const RAILWAY_ORIGIN = /^https:\/\/[a-z0-9-]+\.up\.railway\.app$/;

// Local dev origins are always allowed (single-user private app; auth is the
// security boundary, not CORS). Covers Vite's default port and 127.0.0.1.
const LOCAL_DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function isAllowedOrigin(origin) {
  if (origin === env.CLIENT_URL) return true;
  if (LOCAL_DEV_ORIGIN.test(origin)) return true;
  if ((process.env.ADDITIONAL_ORIGINS || '').split(',').filter(Boolean).includes(origin)) return true;
  if (env.IS_PRODUCTION && RAILWAY_ORIGIN.test(origin)) return true;
  return false;
}

function securityMiddleware(app) {
  app.disable('x-powered-by');
  app.use(helmet());

  app.use(cors({
    origin(origin, callback) {
      // Allow same-origin/no-origin (curl, health checks) and configured origins.
      if (!origin || isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));

  app.use(expressJsonLimiter());
}

function expressJsonLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please slow down.' },
  });
}

module.exports = { securityMiddleware };
