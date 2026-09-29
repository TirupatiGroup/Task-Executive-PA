// Calendar routes: /api/v1/calendar (read-only shared calendar).

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { connectionBody, connectionPatch, refreshBody, eventsQuery } = require('../validators/calendar.validator');
const controller = require('../controllers/calendar.controller');

const router = express.Router();
router.use(requireAuth);

router.get('/status', controller.status);
router.get('/calendars', controller.listCalendars);
router.post('/connection', validate({ body: connectionBody }), controller.saveConnection);
router.patch('/connection', validate({ body: connectionPatch }), controller.updateConnection);
router.get('/events', validate({ query: eventsQuery }), controller.getEvents);
router.post('/refresh', validate({ body: refreshBody }), controller.refresh);

module.exports = router;
