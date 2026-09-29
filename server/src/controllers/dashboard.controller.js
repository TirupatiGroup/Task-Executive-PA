// Dashboard controller - thin; delegates to dashboardService.

const { asyncHandler, success } = require('../utils/response');
const { dashboardService } = require('../services/dashboard.service');

const summary = asyncHandler(async (req, res) => {
  const data = await dashboardService.getSummary(req.user.id);
  return success(res, { message: 'Dashboard summary', data });
});

const workQueue = asyncHandler(async (req, res) => {
  const data = await dashboardService.getWorkQueue(req.user.id, { limit: Math.min(parseInt(req.query.limit || '25', 10), 50) });
  return success(res, { message: 'Work queue', data });
});

const deadlineBoard = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDeadlineBoard(req.user.id);
  return success(res, { message: 'Deadline board', data });
});

const followUpBoard = asyncHandler(async (req, res) => {
  const data = await dashboardService.getFollowUpBoard(req.user.id);
  return success(res, { message: 'Follow-up board', data });
});

module.exports = { summary, workQueue, deadlineBoard, followUpBoard };
