// Task and follow-up controllers - thin; delegate to services.

const { asyncHandler, success } = require('../utils/response');
const { taskService } = require('../services/task.service');
const { followupService } = require('../services/followup.service');

const listTasks = asyncHandler(async (req, res) => {
  const result = await taskService.listTasks(req.query, {
    page: parseInt(req.query.page || '1', 10),
    limit: parseInt(req.query.limit || '20', 10),
  });
  return success(res, { message: 'Tasks fetched', data: result });
});

const getTask = asyncHandler(async (req, res) => {
  const task = await taskService.getTaskDetail(req.params.id);
  return success(res, { message: 'Task fetched', data: { task } });
});

const createTask = asyncHandler(async (req, res) => {
  const task = await taskService.createTask(req.body, req.user.id);
  return success(res, { message: 'Task created', data: { task }, status: 201 });
});

const updateTask = asyncHandler(async (req, res) => {
  const task = await taskService.updateTask(req.params.id, req.body, req.user.id);
  return success(res, { message: 'Task updated', data: { task } });
});

const changeTaskStatus = asyncHandler(async (req, res) => {
  const task = await taskService.changeStatus(req.params.id, req.body.status, req.user.id);
  return success(res, { message: `Task status changed to ${task.status}`, data: { task } });
});

const addFollowUp = asyncHandler(async (req, res) => {
  const followUp = await followupService.addFollowUp(req.params.id, req.body, req.user.id);
  return success(res, { message: 'Follow-up added', data: { followUp }, status: 201 });
});

const listFollowUps = asyncHandler(async (req, res) => {
  const followUps = await followupService.listTaskFollowUps(req.params.id);
  return success(res, { message: 'Follow-ups fetched', data: { followUps } });
});

module.exports = { listTasks, getTask, createTask, updateTask, changeTaskStatus, addFollowUp, listFollowUps };
