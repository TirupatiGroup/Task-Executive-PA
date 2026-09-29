// Centralized async handler + API response helpers.
// Success: { success, message, data }
// Error:   { success, message, errors }

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const success = (res, { message = 'OK', data = {}, status = 200 } = {}) => {
  res.status(status).json({ success: true, message, data });
};

module.exports = { asyncHandler, success };
