// Search routes: /api/v1/search

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validateQuery } = require('../middleware/validate');
const { searchQuery } = require('../validators/search.validator');
const { search } = require('../controllers/search.controller');

const router = express.Router();
router.use(requireAuth);
router.get('/', validateQuery(searchQuery), search);

module.exports = router;
