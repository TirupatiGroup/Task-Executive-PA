// Auth routes: email+password login + current user info.

const express = require('express');
const { z } = require('zod');
const { authenticateWithPassword, requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { asyncHandler, success } = require('../utils/response');

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

// POST /api/v1/auth/login
router.post('/login', validateBody(loginSchema), asyncHandler(async (req, res) => {
  const { user, sessionToken } = await authenticateWithPassword(req.body.email, req.body.password);
  return success(res, {
    message: 'Signed in',
    data: {
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      sessionToken,
      expiresIn: 12 * 60 * 60,
    },
  });
}));

// GET /api/v1/auth/me
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  return success(res, {
    message: 'Current user',
    data: { user: { id: req.user.id, email: req.user.email, displayName: req.user.displayName, role: req.user.role } },
  });
}));

// POST /api/v1/auth/logout - stateless; client discards token.
router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  return success(res, { message: 'Signed out' });
}));

module.exports = router;
