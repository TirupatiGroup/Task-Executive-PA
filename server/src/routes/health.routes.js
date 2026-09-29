// Health + API index routes (Phase 1).

const express = require('express');
const { prisma } = require('../config/database');
const { asyncHandler, success } = require('../utils/response');

const router = express.Router();

// GET /api/v1/health - safe API/database status.
router.get('/health', asyncHandler(async (req, res) => {
  let database = 'down';
  try {
    // MongoDB connector: ping via runCommand (no SQL/raw queries on Mongo).
    await prisma.$runCommandRaw({ ping: 1 });
    database = 'up';
  } catch {
    database = 'down';
  }
  return success(res, {
    message: 'Service healthy',
    data: { status: 'ok', database, time: new Date().toISOString() },
  });
}));

module.exports = router;
