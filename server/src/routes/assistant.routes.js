// Assistant routes: /api/v1/assistant

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { queryBody, prepareBody, executeBody } = require('../validators/assistant.validator');
const controller = require('../controllers/assistant.controller');

const router = express.Router();
router.use(requireAuth);

router.get('/capabilities', controller.capabilities);
router.post('/query', validateBody(queryBody), controller.query);
router.post('/action', validateBody(executeBody), controller.executeAction);
router.post('/action/prepare', validateBody(prepareBody), controller.prepareAction);

module.exports = router;
