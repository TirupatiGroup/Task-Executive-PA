// Calendar controller - thin; requires backend session + Graph token headers.

const { asyncHandler, success } = require('../utils/response');
const { calendarService } = require('../services/calendar.service');
const { UnauthorizedError } = require('../utils/errors');

// The Graph access token is sent by the SPA in a dedicated header and is used
// only for the duration of the request. It is never persisted or logged.
function getGraphToken(req) {
  const token = req.headers['x-graph-token'];
  if (!token || typeof token !== 'string') throw new UnauthorizedError('Microsoft Graph token missing');
  return token;
}

const status = asyncHandler(async (req, res) => {
  const data = await calendarService.getStatus(req.user.id);
  return success(res, { message: 'Calendar status', data });
});

const listCalendars = asyncHandler(async (req, res) => {
  const data = await calendarService.listAvailableCalendars(req.user.id, getGraphToken(req));
  return success(res, { message: 'Calendars fetched', data: { calendars: data } });
});

const saveConnection = asyncHandler(async (req, res) => {
  const connection = await calendarService.saveConnection(req.user.id, req.body);
  return success(res, { message: 'Calendar connection saved', data: { connection } });
});

const updateConnection = asyncHandler(async (req, res) => {
  const connection = await calendarService.updateConnection(req.user.id, req.body);
  return success(res, { message: 'Calendar connection updated', data: { connection } });
});

const getEvents = asyncHandler(async (req, res) => {
  const data = await calendarService.getEvents(req.user.id, {
    start: req.query.start,
    end: req.query.end,
  });
  return success(res, { message: 'Events fetched', data: { events: data } });
});

const refresh = asyncHandler(async (req, res) => {
  const result = await calendarService.refreshEvents(req.user.id, getGraphToken(req), {
    start: req.body.start,
    end: req.body.end,
  });
  return success(res, { message: 'Calendar refreshed', data: result });
});

module.exports = { status, listCalendars, saveConnection, updateConnection, getEvents, refresh };
