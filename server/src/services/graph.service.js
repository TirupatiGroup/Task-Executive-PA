// Microsoft Graph service - read-only shared calendar access, least privilege.
//
// Auth model: the SPA obtains an access token (via MSAL) scoped to
// Calendars.Read (delegated) and sends it alongside the backend session token.
// The backend uses that Graph token purely for Graph calls on behalf of the
// signed-in user and NEVER stores or logs it. No Mail.Read or mailbox scope.

const axios = require('axios');
const { ForbiddenError, UnauthorizedError } = require('../utils/errors');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

function graphClient(accessToken) {
  if (!accessToken) throw new UnauthorizedError('Microsoft Graph token missing');
  return axios.create({
    baseURL: GRAPH_BASE,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      Prefer: 'outlook.timezone="Asia/Kolkata"',
    },
    timeout: 15000,
  });
}

function safeGraphError(error, action) {
  const status = error.response?.status;
  const retryAfter = error.response?.headers?.['retry-after'];
  const err = new Error(`Graph ${action} failed${status ? ` (HTTP ${status})` : ''}`);
  err.statusCode = status === 401 || status === 403 ? 502 : 502;
  err.graphStatus = status;
  err.retryAfter = retryAfter ? parseInt(retryAfter, 10) : undefined;
  return err;
}

const graphService = {
  // List calendars visible to the signed-in user (for selecting the shared one).
  async listCalendars(graphToken) {
    try {
      const client = graphClient(graphToken);
      const res = await client.get('/me/calendars?$select=id,name,color,isDefaultCalendar,owner&$top=50');
      return (res.data.value || []).map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        isDefault: c.isDefaultCalendar,
        owner: c.owner?.address || c.owner?.name || null,
      }));
    } catch (error) {
      throw safeGraphError(error, 'listCalendars');
    }
  },

  // Fetch events in a window from a specific (shared) calendar.
  // Returns normalized event objects; only fields Graph actually returned.
  async getCalendarEvents(graphToken, { calendarId, startIso, endIso }) {
    try {
      const client = graphClient(graphToken);
      const url = calendarId
        ? `/me/calendars/${encodeURIComponent(calendarId)}/calendarView`
        : '/me/calendar/calendarView';
      const params = {
        startDateTime: startIso,
        endDateTime: endIso,
        $select: 'id,subject,bodyPreview,start,end,isAllDay,location,organizer,onlineMeetingUrl,lastModifiedDateTime,isOrganizer',
        $orderby: 'start/dateTime asc',
        $top: 200,
      };
      const res = await client.get(url, { params });
      return (res.data.value || []).map((e) => ({
        graphEventId: e.id,
        subject: e.subject || null,
        bodyPreview: e.bodyPreview ? String(e.bodyPreview).slice(0, 500) : null,
        start: e.start, // { dateTime, timeZone }
        end: e.end,
        isAllDay: !!e.isAllDay,
        location: e.location?.displayName || null,
        organizerName: e.organizer?.emailAddress?.name || null,
        organizerEmail: e.organizer?.emailAddress?.address || null,
        onlineMeetingUrl: e.onlineMeetingUrl || null,
        lastModifiedAt: e.lastModifiedDateTime || null,
      }));
    } catch (error) {
      throw safeGraphError(error, 'getCalendarEvents');
    }
  },

  // Build ISO start/end for a Graph calendarView window.
  buildWindow(startUtc, endUtc) {
    return { startIso: new Date(startUtc).toISOString(), endIso: new Date(endUtc).toISOString() };
  },
};

module.exports = { graphService, GRAPH_BASE };
