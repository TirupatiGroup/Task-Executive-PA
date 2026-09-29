// Dashboard routes: /api/v1/dashboard

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/response');
const controller = require('../controllers/dashboard.controller');

const router = express.Router();
router.use(requireAuth);

router.get('/summary', controller.summary);
router.get('/work-queue', controller.workQueue);
router.get('/deadline-board', controller.deadlineBoard);
router.get('/followup-board', controller.followUpBoard);
router.get('/task-summary', controller.summary); // legacy alias from Phase 2 plan

module.exports = router;
