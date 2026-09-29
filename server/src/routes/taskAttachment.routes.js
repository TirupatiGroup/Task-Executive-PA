// TaskAttachment routes: /api/v1/tasks (mounted under tasks prefix).

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idParams } = require('../validators/task.validator');
const { z } = require('../validators/common');
const controller = require('../controllers/taskAttachment.controller');

const router = express.Router();
router.use(requireAuth);

const attachmentIdParams = idParams.extend({
  attachmentId: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid attachment id format'),
});

router.post('/:id/attachments', validate({ params: idParams }), controller.uploadAttachment);
router.get('/:id/attachments', validate({ params: idParams }), controller.listAttachments);
router.delete('/:id/attachments/:attachmentId', validate({ params: attachmentIdParams }), controller.deleteAttachment);

module.exports = router;
