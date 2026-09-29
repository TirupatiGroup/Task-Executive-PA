// 404 handler and centralized safe error handler.
// Never exposes stack traces or database internals in production.

const { isProduction } = require('../config/env');
const { logger } = require('../utils/logger');
const { AppError } = require('../utils/errors');

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: 'Route not found', errors: [] });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = Array.isArray(err.errors) ? err.errors : [];

  // Zod error support
  if (err.name === 'ZodError') {
    statusCode = 422;
    message = 'Validation failed';
    errors = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  }

  if (!(err instanceof AppError)) {
    logger.error('Unhandled error', { path: req.originalUrl, error: err.message, stack: isProduction() ? undefined : err.stack });
  }

  if (isProduction() && statusCode >= 500) {
    message = 'Internal server error';
    errors = [];
  }

  res.status(statusCode).json({ success: false, message, errors });
}

module.exports = { notFoundHandler, errorHandler };
