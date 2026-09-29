// Activity routes: /api/v1/activity

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validateQuery } = require('../middleware/validate');
const { activityQuery } = require('../validators/search.validator');
const { listActivity } = require('../controllers/activity.controller');

const router = express.Router();
router.use(requireAuth);
router.get('/', validateQuery(activityQuery), listActivity);

module.exports = router;
