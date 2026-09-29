// Security middleware: Helmet, CORS, rate limiting, request-size limits.

const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');

function securityMiddleware(app) {
  app.disable('x-powered-by');
  app.use(helmet());

  const allowedOrigins = [env.CLIENT_URL]
    .filter(Boolean)
    .concat((process.env.ADDITIONAL_ORIGINS || '').split(',').filter(Boolean));

  app.use(cors({
    origin(origin, callback) {
      // Allow same-origin/no-origin (curl, health checks) and configured origins.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
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
