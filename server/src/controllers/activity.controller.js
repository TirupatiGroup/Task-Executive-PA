// Activity controller.

const { asyncHandler, success } = require('../utils/response');
const { activityService } = require('../services/activity.service');

const listActivity = asyncHandler(async (req, res) => {
  const data = await activityService.listActivity({
    entityType: req.query.entityType,
    action: req.query.action,
    entityId: req.query.entityId,
    page: parseInt(req.query.page || '1', 10),
    limit: Math.min(parseInt(req.query.limit || '20', 10), 100),
  });
  return success(res, { message: 'Activity history', data });
});

module.exports = { listActivity };
