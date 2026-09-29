// Validators for notification/settings/reminder routes.

const { z, cuidString, paginationQuery } = require('./common');

const notificationQuery = paginationQuery.extend({
  type: z.enum(['TASK_DEADLINE', 'FOLLOW_UP_DUE', 'MEETING_REMINDER', 'SYSTEM']).optional(),
  isRead: z.enum(['true', 'false']).optional(),
});

const idParams = z.object({ id: cuidString });

const readBody = z.object({ isRead: z.boolean() });

const settingsPatch = z.object({
  timezone: z.string().max(60).optional(),
  briefingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm').optional(),
  briefingEnabled: z.boolean().optional(),
  defaultTaskLeadHours: z.number().int().min(0).max(168).optional(),
  defaultFollowUpLeadHours: z.number().int().min(0).max(168).optional(),
  defaultMeetingLeadMinutes: z.number().int().min(0).max(1440).optional(),
  browserNotificationsEnabled: z.boolean().optional(),
  voiceEnabled: z.boolean().optional(),
  speechRate: z.number().min(0.5).max(2).optional(),
  speechPitch: z.number().min(0.5).max(2).optional(),
});

const snoozeBody = z.object({
  snoozedUntil: z.string().datetime({ offset: true }),
});

module.exports = { notificationQuery, idParams, readBody, settingsPatch, snoozeBody };
