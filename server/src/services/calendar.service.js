// Calendar service - connection management, event fetch + local cache upsert.
//
// NOTE: All Prisma .upsert() calls have been replaced with manual
// check-then-create-or-update patterns because Prisma upsert() requires a
// MongoDB replica set. Unique indexes still protect us against races; we
// catch the duplicate-key error and fall back to update() for idempotency.

const { Prisma } = require('@prisma/client');
const { prisma } = require('../config/database');
const { graphService } = require('./graph.service');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { startOfBusinessDay, endOfBusinessDay, addBusinessDaysUTC } = require('../utils/dates');

const MAX_WINDOW_DAYS = 62;

function parseDateOrThrow(value, field) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new ValidationError(`Invalid ${field}`);
  return d;
}

function normalizeEventDates(ev) {
  const start = new Date(`${ev.start.dateTime}Z`);
  const end = new Date(`${ev.end.dateTime}Z`);
  return { startAt: start, endAt: end, timeZone: ev.start.timeZone || null };
}

// --- Standalone-MongoDB safe upsert helpers --------------------------------

async function upsertCalendarConnection(userId, createData, updateData) {
  const existing = await prisma.calendarConnection.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (existing) {
    return prisma.calendarConnection.update({
      where: { userId },
      data: updateData,
    });
  }
  try {
    return await prisma.calendarConnection.create({
      data: { userId, ...createData },
    });
  } catch (err) {
    const isDupe =
      err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
    if (isDupe) {
      return prisma.calendarConnection.update({ where: { userId }, data: updateData });
    }
    throw err;
  }
}

async function upsertCalendarEventByGraphId(userId, graphEventId, createData, updateData) {
  const existing = await prisma.calendarEvent.findUnique({
    where: { userId_graphEventId: { userId, graphEventId } },
    select: { id: true },
  });
  if (existing) {
    return prisma.calendarEvent.update({
      where: { id: existing.id },
      data: updateData,
    });
  }
  try {
    return await prisma.calendarEvent.create({
      data: { userId, graphEventId, ...createData },
    });
  } catch (err) {
    const isDupe =
      err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
    if (isDupe) {
      return prisma.calendarEvent.update({
        where: { userId_graphEventId: { userId, graphEventId } },
        data: updateData,
      });
    }
    throw err;
  }
}

const calendarService = {
  MAX_WINDOW_DAYS,

  async getStatus(userId) {
    const connection = await prisma.calendarConnection.findUnique({ where: { userId } });
    return {
      connected: !!connection?.graphCalendarId,
      isEnabled: !!connection?.isEnabled,
      calendarLabel: connection?.calendarLabel || null,
      ownerEmailAddress: connection?.ownerEmailAddress || null,
      syncStatus: connection?.syncStatus || 'NEVER_SYNCED',
      lastSyncAttemptAt: connection?.lastSyncAttemptAt || null,
      lastSuccessfulSyncAt: connection?.lastSuccessfulSyncAt || null,
      lastSyncError: connection?.lastSyncError || null,
    };
  },

  async listAvailableCalendars(userId, graphToken) {
    return graphService.listCalendars(graphToken);
  },

  async saveConnection(userId, { calendarId, label, ownerEmailAddress, isEnabled }) {
    if (!calendarId || typeof calendarId !== 'string') {
      throw new ValidationError('calendarId is required');
    }
    const createData = {
      graphCalendarId: calendarId,
      calendarLabel: label || null,
      ownerEmailAddress: ownerEmailAddress || null,
      isEnabled: isEnabled !== false,
    };
    const updateData = {
      ...createData,
      syncStatus: 'NEVER_SYNCED',
      lastSyncError: null,
    };
    return upsertCalendarConnection(userId, createData, updateData);
  },

  async updateConnection(userId, patch) {
    const data = {};
    if (patch.isEnabled !== undefined) data.isEnabled = Boolean(patch.isEnabled);
    if (patch.calendarLabel !== undefined) data.calendarLabel = patch.calendarLabel;
    return prisma.calendarConnection.update({ where: { userId }, data });
  },

  // Fetch + upsert events for a validated window. Returns cached rows.
  async refreshEvents(userId, graphToken, { start, end } = {}) {
    const connection = await prisma.calendarConnection.findUnique({ where: { userId } });
    if (!connection || !connection.graphCalendarId || !connection.isEnabled) {
      throw new NotFoundError('No connected shared calendar. Connect a calendar first.');
    }

    const startUtc = start ? parseDateOrThrow(start, 'start') : startOfBusinessDay();
    let endUtc = end ? parseDateOrThrow(end, 'end') : endOfBusinessDay(addBusinessDaysUTC(startOfBusinessDay(), 7));

    if (endUtc <= startUtc) throw new ValidationError('End must be after start');
    if ((endUtc - startUtc) / 86400000 > MAX_WINDOW_DAYS) {
      throw new ValidationError(`Date window must not exceed ${MAX_WINDOW_DAYS} days`);
    }

    await prisma.calendarConnection.update({
      where: { userId },
      data: { lastSyncAttemptAt: new Date(), syncStatus: 'SYNCING' },
    });

    try {
      const window = graphService.buildWindow(startUtc, endUtc);
      const events = await graphService.getCalendarEvents(graphToken, {
        calendarId: connection.graphCalendarId,
        startIso: window.startIso,
        endIso: window.endIso,
      });

      for (const ev of events) {
        const { startAt, endAt, timeZone } = normalizeEventDates(ev);
        const createData = {
          connectionId: connection.id,
          graphCalendarId: connection.graphCalendarId,
          subject: ev.subject,
          bodyPreview: ev.bodyPreview,
          startAt,
          endAt,
          timeZone,
          isAllDay: ev.isAllDay,
          location: ev.location,
          organizerName: ev.organizerName,
          organizerEmail: ev.organizerEmail,
          onlineMeetingUrl: ev.onlineMeetingUrl,
          lastModifiedAt: ev.lastModifiedAt ? new Date(ev.lastModifiedAt) : null,
        };
        const updateData = {
          ...createData,
          fetchedAt: new Date(),
        };
        await upsertCalendarEventByGraphId(userId, ev.graphEventId, createData, updateData);
      }

      await prisma.calendarConnection.update({
        where: { userId },
        data: { syncStatus: 'SYNCED', lastSuccessfulSyncAt: new Date(), lastSyncError: null },
      });

      return { fetched: events.length };
    } catch (error) {
      await prisma.calendarConnection.update({
        where: { userId },
        data: {
          syncStatus: 'ERROR',
          lastSyncError: String(error.message || 'Sync failed').slice(0, 300),
        },
      });
      throw error;
    }
  },

  // Read cached, normalized events for a validated window.
  async getEvents(userId, { start, end } = {}) {
    const startUtc = start ? parseDateOrThrow(start, 'start') : startOfBusinessDay();
    let endUtc = end ? parseDateOrThrow(end, 'end') : endOfBusinessDay(addBusinessDaysUTC(startOfBusinessDay(), 1));
    if (endUtc <= startUtc) throw new ValidationError('End must be after start');
    if ((endUtc - startUtc) / 86400000 > MAX_WINDOW_DAYS) {
      throw new ValidationError(`Date window must not exceed ${MAX_WINDOW_DAYS} days`);
    }

    const events = await prisma.calendarEvent.findMany({
      where: { userId, startAt: { gte: startUtc, lte: endUtc } },
      orderBy: { startAt: 'asc' },
    });

    return events.map((e) => ({
      id: e.id,
      graphEventId: e.graphEventId,
      subject: e.subject,
      bodyPreview: e.bodyPreview,
      startAt: e.startAt,
      endAt: e.endAt,
      timeZone: e.timeZone,
      isAllDay: e.isAllDay,
      location: e.location,
      organizerName: e.organizerName,
      organizerEmail: e.organizerEmail,
      onlineMeetingUrl: e.onlineMeetingUrl,
    }));
  },

  // Dashboard helpers.
  async getTodayMeetings(userId, { limit = 5 } = {}) {
    const now = new Date();
    const events = await prisma.calendarEvent.findMany({
      where: {
        userId,
        startAt: { gte: startOfBusinessDay(now), lte: endOfBusinessDay(now) },
      },
      orderBy: { startAt: 'asc' },
      take: limit,
    });
    const count = await prisma.calendarEvent.count({
      where: { userId, startAt: { gte: startOfBusinessDay(now), lte: endOfBusinessDay(now) } },
    });
    return { events, count, next: events.find((e) => new Date(e.endAt) >= now) || null };
  },
};

module.exports = { calendarService };
