// Validators for calendar routes.

const { z } = require('./common');

const connectionBody = z.object({
  calendarId: z.string().min(1).max(200),
  label: z.string().max(200).optional(),
  ownerEmailAddress: z.string().email().max(200).nullable().optional(),
  isEnabled: z.boolean().optional(),
});

const connectionPatch = z.object({
  isEnabled: z.boolean().optional(),
  calendarLabel: z.string().max(200).optional(),
});

const refreshBody = z.object({
  start: z.string().datetime({ offset: true }).optional(),
  end: z.string().datetime({ offset: true }).optional(),
});

const eventsQuery = z.object({
  start: z.string().min(10).max(40).optional(),
  end: z.string().min(10).max(40).optional(),
});

module.exports = { connectionBody, connectionPatch, refreshBody, eventsQuery };
