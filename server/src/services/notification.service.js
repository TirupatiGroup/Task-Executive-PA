// Notification service - idempotent notification generation + inbox management.

const { notificationRepository } = require('../repositories/notification.repository');
const { reminderRepository } = require('../repositories/reminder.repository');
const { NotFoundError, ValidationError } = require('../utils/errors');

const NOTIFICATION_TYPES = ['TASK_DEADLINE', 'FOLLOW_UP_DUE', 'MEETING_REMINDER', 'SYSTEM'];

function dedupeKeyFor(type, sourceId, windowKey) {
  return `${type}:${sourceId}:${windowKey}`;
}

const notificationService = {
  NOTIFICATION_TYPES,
  dedupeKeyFor,

  // Idempotent upsert - safe on scheduler restarts / repeated runs.
  async pushNotification(data) {
    const key = data.dedupeKey || dedupeKeyFor(data.type, data.sourceId || 'system', data.windowKey || 'once');
    return notificationRepository.upsertByDedupeKey({
      userId: data.userId,
      type: data.type,
      severity: data.severity || 'INFO',
      title: data.title,
      body: data.body || null,
      sourceType: data.sourceType || null,
      sourceId: data.sourceId || null,
      linkPath: data.linkPath || null,
      dedupeKey: key,
      scheduledFor: data.scheduledFor || null,
    });
  },

  async listNotifications(userId, { type, isRead, page = 1, limit = 20 }) {
    const where = { userId };
    if (type && NOTIFICATION_TYPES.includes(type)) where.type = type;
    if (isRead === 'true') where.isRead = true;
    if (isRead === 'false') where.isRead = false;

    const [items, total, unread] = await Promise.all([
      notificationRepository.findMany({ where, skip: (page - 1) * limit, take: limit }),
      notificationRepository.count(where),
      notificationRepository.count({ userId, isRead: false }),
    ]);
    return { items, unread, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  },

  async setRead(userId, id, isRead) {
    const n = await notificationRepository.findById(id);
    if (!n || n.userId !== userId) throw new NotFoundError('Notification not found');
    return notificationRepository.update(id, { isRead, readAt: isRead ? new Date() : null });
  },

  async markAllRead(userId) {
    const res = await notificationRepository.markAllRead(userId);
    return { updated: res.count };
  },

  async snoozeReminder(userId, reminderId, snoozedUntil) {
    const reminder = await reminderRepository.findById(reminderId);
    if (!reminder || reminder.task.createdById !== userId) throw new NotFoundError('Reminder not found');
    const target = new Date(snoozedUntil);
    if (Number.isNaN(target.getTime())) throw new ValidationError('Invalid snooze time');
    if (target.getTime() <= Date.now()) throw new ValidationError('Snooze time must be in the future');
    const maxSnooze = Date.now() + 7 * 24 * 3600 * 1000; // 7 days max
    if (target.getTime() > maxSnooze) throw new ValidationError('Snooze window must be within 7 days');

    return reminderRepository.update(reminderId, { snoozedUntil: target, processedAt: null });
  },
};

module.exports = { notificationService };
