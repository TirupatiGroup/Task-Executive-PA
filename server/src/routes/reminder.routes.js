// Reminder routes: /api/v1/reminders

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idParams, snoozeBody } = require('../validators/notification.validator');
const controller = require('../controllers/notification.controller');

const router = express.Router();
router.use(requireAuth);

router.post('/:id/snooze', validate({ params: idParams, body: snoozeBody }), controller.snoozeReminder);
router.post('/run-scheduler', controller.runScheduler);

module.exports = router;
