// Search controller.

const { asyncHandler, success } = require('../utils/response');
const { searchService } = require('../services/search.service');
const { UnauthorizedError } = require('../utils/errors');

const search = asyncHandler(async (req, res) => {
  if (!req.user || !req.user.id) throw new UnauthorizedError();
  const data = await searchService.globalSearch(req.user.id, req.query.q, {
    limit: Math.min(parseInt(req.query.limit || '10', 10), 25),
  });
  return success(res, { message: 'Search results', data });
});

module.exports = { search };
