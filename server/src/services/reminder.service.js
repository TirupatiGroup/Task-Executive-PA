// Reminder engine - derives due reminders from task deadlines, follow-ups and
// cached calendar events, then creates idempotent notifications.
// The scheduler tick is safe to run repeatedly (dedupeKey-based upsert).

const { prisma } = require('../config/database');
const { notificationService } = require('./notification.service');
const { startOfBusinessDay, endOfBusinessDay, addBusinessDaysUTC, formatBusiness } = require('../utils/dates');
const { logger } = require('../utils/logger');

function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

const reminderService = {
  // Main scheduler entry: evaluate everything once. Idempotent.
  async runSchedulerTick(userId) {
    const results = { deadline: 0, followUp: 0, meeting: 0, overdue: 0 };
    try {
      results.deadline = await reminderService.evaluateTaskDeadlines(userId);
      results.followUp = await reminderService.evaluateFollowUps(userId);
      results.meeting = await reminderService.evaluateMeetings(userId);
      results.overdue = await reminderService.evaluateOverdue(userId);
    } catch (err) {
      logger.error('Scheduler tick failed', { error: err.message });
    }
    return results;
  },

  async evaluateTaskDeadlines(userId) {
    const now = new Date();
    const todayStart = startOfBusinessDay(now);
    const todayEnd = endOfBusinessDay(now);
    const soonEnd = endOfBusinessDay(addBusinessDaysUTC(now, 2));

    // Tasks due today (not completed/cancelled).
    const dueToday = await prisma.task.findMany({
      where: { createdById: userId, status: { notIn: ['COMPLETED', 'CANCELLED'] }, dueDate: { gte: todayStart, lte: todayEnd } },
    });
    for (const task of dueToday) {
      await notificationService.pushNotification({
        userId,
        type: 'TASK_DEADLINE',
        severity: 'WARNING',
        title: `Due today: ${task.title}`,
        body: task.dueDate ? `Deadline ${formatBusiness(task.dueDate, 'h:mm a')}` : null,
        sourceType: 'TASK',
        sourceId: task.id,
        linkPath: `/tasks/${task.id}`,
        windowKey: `due-${dayKey(todayEnd)}`,
      });
    }

    // Tasks due within 48h (excluding today to avoid duplicate alerts).
    const upcoming = await prisma.task.findMany({
      where: { createdById: userId, status: { notIn: ['COMPLETED', 'CANCELLED'] }, dueDate: { gt: todayEnd, lte: soonEnd } },
    });
    for (const task of upcoming) {
      await notificationService.pushNotification({
        userId,
        type: 'TASK_DEADLINE',
        severity: 'INFO',
        title: `Upcoming deadline: ${task.title}`,
        body: task.dueDate ? `Due ${formatBusiness(task.dueDate, 'EEE dd MMM, h:mm a')}` : null,
        sourceType: 'TASK',
        sourceId: task.id,
        linkPath: `/tasks/${task.id}`,
        windowKey: `upcoming-${dayKey(task.dueDate)}`,
      });
    }
    return dueToday.length + upcoming.length;
  },

  async evaluateFollowUps(userId) {
    const now = new Date();
    const todayEnd = endOfBusinessDay(now);

    // Latest follow-up per active task with nextFollowUpAt due.
    const dueFollowUps = await prisma.followUp.findMany({
      where: {
        nextFollowUpAt: { lte: todayEnd },
        task: { createdById: userId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      },
      include: { task: { select: { id: true, title: true } } },
      orderBy: { nextFollowUpAt: 'asc' },
    });

    // Only the latest nextFollowUpAt per task should notify.
    const latestByTask = new Map();
    for (const f of dueFollowUps) {
      const existing = latestByTask.get(f.taskId);
      if (!existing || new Date(f.nextFollowUpAt) > new Date(existing.nextFollowUpAt)) {
        latestByTask.set(f.taskId, f);
      }
    }

    for (const [taskId, f] of latestByTask) {
      await notificationService.pushNotification({
        userId,
        type: 'FOLLOW_UP_DUE',
        severity: 'WARNING',
        title: `Follow-up due: ${f.task.title}`,
        body: (f.note || '').slice(0, 140),
        sourceType: 'TASK',
        sourceId: taskId,
        linkPath: `/tasks/${taskId}`,
        windowKey: `followup-${dayKey(f.nextFollowUpAt)}`,
      });
    }
    return latestByTask.size;
  },

  async evaluateMeetings(userId) {
    const now = new Date();
    const todayStart = startOfBusinessDay(now);
    const todayEnd = endOfBusinessDay(now);

    const events = await prisma.calendarEvent.findMany({
      where: { userId, startAt: { gte: todayStart, lte: todayEnd } },
      orderBy: { startAt: 'asc' },
    });

    for (const ev of events) {
      const start = new Date(ev.startAt);
      if (start <= now) continue; // already started/finished
      await notificationService.pushNotification({
        userId,
        type: 'MEETING_REMINDER',
        severity: 'INFO',
        title: ev.subject || 'Meeting',
        body: `Starts ${formatBusiness(start, 'h:mm a')}${ev.location ? ` · ${ev.location}` : ''}`,
        sourceType: 'CALENDAR_EVENT',
        sourceId: ev.id,
        linkPath: '/calendar',
        windowKey: `meeting-${ev.graphEventId.slice(0, 40)}-${dayKey(ev.startAt)}`,
      });
    }
    return events.length;
  },

  async evaluateOverdue(userId) {
    const now = new Date();
    const todayKey = dayKey(now);
    const overdue = await prisma.task.findMany({
      where: { createdById: userId, status: { notIn: ['COMPLETED', 'CANCELLED'] }, dueDate: { lt: startOfBusinessDay(now) } },
    });
    for (const task of overdue) {
      await notificationService.pushNotification({
        userId,
        type: 'TASK_DEADLINE',
        severity: 'URGENT',
        title: `Overdue: ${task.title}`,
        body: task.dueDate ? `Was due ${formatBusiness(task.dueDate, 'EEE dd MMM, h:mm a')}` : null,
        sourceType: 'TASK',
        sourceId: task.id,
        linkPath: `/tasks/${task.id}`,
        windowKey: `overdue-${todayKey}`,
      });
    }
    return overdue.length;
  },

  // Generate per-task reminders when requested explicitly.
  async createTaskReminder(userId, taskId, remindAt, leadMinutes = 0) {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.createdById !== userId) throw new NotFoundError('Task not found');
    const when = new Date(remindAt);
    if (Number.isNaN(when.getTime())) throw new ValidationError('Invalid remind time');
    return prisma.reminder.create({
      data: { taskId, remindAt: when, leadMinutes },
    });
  },

  async snooze(userId, reminderId, snoozedUntil) {
    return notificationService.snoozeReminder(userId, reminderId, snoozedUntil);
  },
};

module.exports = { reminderService };
