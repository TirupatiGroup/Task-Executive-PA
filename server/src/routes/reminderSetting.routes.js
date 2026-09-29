// Reminder settings routes: /api/v1/reminder-settings

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { settingsPatch } = require('../validators/notification.validator');
const controller = require('../controllers/notification.controller');

const router = express.Router();
router.use(requireAuth);

router.get('/', controller.getReminderSettings);
router.patch('/', validateBody(settingsPatch), controller.updateReminderSettings);

module.exports = router;
