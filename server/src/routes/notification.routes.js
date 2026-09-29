// Notification routes: /api/v1/notifications

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { notificationQuery, idParams, readBody } = require('../validators/notification.validator');
const controller = require('../controllers/notification.controller');

const router = express.Router();
router.use(requireAuth);

router.get('/', validate({ query: notificationQuery }), controller.listNotifications);
router.post('/read-all', controller.markAllRead);
router.patch('/:id/read', validate({ params: idParams, body: readBody }), controller.setNotificationRead);

module.exports = router;
