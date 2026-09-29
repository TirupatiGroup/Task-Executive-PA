// Business error types used across the layered backend.

class AppError extends Error {
  constructor(message, statusCode = 500, errors = []) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = []) {
    super(message, 422, errors);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
};
