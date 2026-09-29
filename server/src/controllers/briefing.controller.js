// Briefing controller.

const { asyncHandler, success } = require('../utils/response');
const { briefingService } = require('../services/briefing.service');

const today = asyncHandler(async (req, res) => {
  const data = await briefingService.getTodayBriefing(req.user.id);
  return success(res, { message: 'Daily briefing', data });
});

module.exports = { today };
