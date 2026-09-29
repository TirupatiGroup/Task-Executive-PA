// Authentication & authorization middleware.
//
// Strategy (simple email + password auth, single user):
// 1. The SPA POSTs email + password to /api/v1/auth/login.
// 2. The backend checks the allowlist, verifies the bcrypt hash, ensures the
//    account is active and mints a short-lived backend session JWT.
// 3. All protected API calls carry this backend JWT in Authorization header.
// Passwords are never stored in plaintext and never logged.

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { env } = require('../config/env');
const { prisma } = require('../config/database');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const { logger } = require('../utils/logger');

const BCRYPT_ROUNDS = 12;

function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

function signSessionToken(user) {
  if (!env.JWT_SECRET) {
    throw new UnauthorizedError('Session token signing is not configured (JWT_SECRET missing)');
  }
  const payload = { sub: user.id, email: user.email, role: user.role };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '12h' });
}

function decodeSessionToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

// Verify credentials for login. Returns { user, sessionToken } or throws.
async function authenticateWithPassword(email, password) {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new UnauthorizedError('Email and password are required');
  }

  // Single-user allowlist: reject accounts not explicitly approved.
  if (env.ALLOWED_USER_EMAIL && normalizedEmail !== env.ALLOWED_USER_EMAIL.toLowerCase()) {
    logger.warn('Blocked login attempt from non-allowlisted account', { emailDomain: normalizedEmail.split('@')[1] });
    throw new ForbiddenError('This account is not authorized to access Executive PA');
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  // Uniform error regardless of which factor failed (no user enumeration).
  if (!user || !user.passwordHash) throw new UnauthorizedError('Invalid email or password');

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) throw new UnauthorizedError('Invalid email or password');
  if (!user.isActive) throw new ForbiddenError('Account is deactivated');

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const sessionToken = signSessionToken(updated);
  return { user: updated, sessionToken };
}

// Express middleware: require a valid backend session token.
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedError();

    const decoded = decodeSessionToken(token);
    const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user || !user.isActive) throw new UnauthorizedError('Session user no longer valid');

    req.user = user; // trusted identity derived from verified token
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError) return next(err);
    if (err.name === 'TokenExpiredError') return next(new UnauthorizedError('Session expired, please sign in again'));
    if (err.name === 'JsonWebTokenError') return next(new UnauthorizedError('Invalid session token'));
    next(err);
  }
}

// Owner identity comes only from verified auth, never from the browser.
function getOwnerUserId(req) {
  if (!req.user || !req.user.id) throw new UnauthorizedError();
  return req.user.id;
}

module.exports = {
  hashPassword,
  authenticateWithPassword,
  signSessionToken,
  decodeSessionToken,
  requireAuth,
  getOwnerUserId,
};
