// Briefing routes: /api/v1/briefing

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { today } = require('../controllers/briefing.controller');

const router = express.Router();
router.use(requireAuth);
router.get('/today', today);

module.exports = router;
