// Task routes: /api/v1/tasks

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idParams, taskQuery, createTaskBody, updateTaskBody, statusBody, followUpBody } = require('../validators/task.validator');
const controller = require('../controllers/task.controller');

const router = express.Router();
router.use(requireAuth);

router.get('/', validate({ query: taskQuery }), controller.listTasks);
router.post('/', validate({ body: createTaskBody }), controller.createTask);
router.get('/:id', validate({ params: idParams }), controller.getTask);
router.patch('/:id', validate({ params: idParams, body: updateTaskBody }), controller.updateTask);
router.patch('/:id/status', validate({ params: idParams, body: statusBody }), controller.changeTaskStatus);
router.post('/:id/followups', validate({ params: idParams, body: followUpBody }), controller.addFollowUp);
router.get('/:id/followups', validate({ params: idParams }), controller.listFollowUps);

module.exports = router;
