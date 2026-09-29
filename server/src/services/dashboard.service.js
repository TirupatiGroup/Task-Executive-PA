// Dashboard service - server-side aggregation for the command centre.

const { taskRepository } = require('../repositories/task.repository');
const { followupRepository } = require('../repositories/followup.repository');
const { taskService } = require('./task.service');
const { followupService } = require('./followup.service');
const { calendarService } = require('./calendar.service');
const { endOfBusinessDay, addBusinessDaysUTC, startOfBusinessDay } = require('../utils/dates');

const dashboardService = {
  // GET /api/v1/dashboard/summary
  async getSummary(userId) {
    const now = new Date();
    const ownerWhere = { createdById: userId };

    const activeWhere = { ...ownerWhere, status: { notIn: ['COMPLETED', 'CANCELLED'] } };
    const overdueWhere = { ...activeWhere, dueDate: { lt: now } };
    const dueTodayWhere = { ...activeWhere, dueDate: { gte: startOfBusinessDay(now), lte: endOfBusinessDay(now) } };
    const upcomingWhere = { ...activeWhere, dueDate: { gt: endOfBusinessDay(now), lte: endOfBusinessDay(addBusinessDaysUTC(now, 7)) } };

    const [
      myTasksActive,
      myTasksCompleted,
      assignedActive,
      overdue,
      dueToday,
      upcomingDeadlines,
      dueFollowUps,
      highPriority,
      recentlyCompleted,
    ] = await Promise.all([
      taskRepository.count(activeWhere),
      taskRepository.count({ ...ownerWhere, status: 'COMPLETED' }),
      taskRepository.count({ ...activeWhere, taskType: 'ASSIGNED' }),
      taskRepository.count(overdueWhere),
      taskRepository.count(dueTodayWhere),
      taskRepository.count(upcomingWhere),
      followupRepository.count({
        nextFollowUpAt: { lte: endOfBusinessDay(now) },
        task: { createdById: userId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      }),
      taskRepository.count({ ...activeWhere, priority: { in: ['HIGH', 'CRITICAL'] } }),
      taskRepository.findMany({ where: { ...ownerWhere, status: 'COMPLETED' }, take: 5, orderBy: { completedAt: 'desc' } }),
    ]);

    const [overdueTasks, dueTodayTasks, priorityTasks, dueFollowUpItems, todayMeetings] = await Promise.all([
      taskRepository.findMany({ where: overdueWhere, take: 5, orderBy: { dueDate: 'asc' } }),
      taskRepository.findMany({ where: dueTodayWhere, take: 5, orderBy: { dueDate: 'asc' } }),
      taskRepository.findMany({ where: { ...activeWhere, priority: { in: ['HIGH', 'CRITICAL'] } }, take: 5, orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }] }),
      followupService.getDueFollowUps({ userId, limit: 5 }),
      calendarService.getTodayMeetings(userId, { limit: 5 }),
    ]);

    return {
      counts: {
        myTasksActive,
        myTasksCompleted,
        assignedActive,
        overdue,
        dueToday,
        upcomingDeadlines,
        dueFollowUps,
        highPriority,
      },
      lists: {
        overdueTasks: overdueTasks.map((t) => taskService.serializeTask(t, now)),
        dueTodayTasks: dueTodayTasks.map((t) => taskService.serializeTask(t, now)),
        priorityTasks: priorityTasks.map((t) => taskService.serializeTask(t, now)),
        recentlyCompleted,
        dueFollowUps: dueFollowUpItems.items,
      },
      todayMeetings: todayMeetings.events,
      meetingsCount: todayMeetings.count,
      nextMeeting: todayMeetings.next,
      generatedAt: now.toISOString(),
    };
  },

  // GET /api/v1/dashboard/work-queue - unified prioritized actionable list.
  async getWorkQueue(userId, { limit = 25 } = {}) {
    const now = new Date();
    const activeWhere = { createdById: userId, status: { notIn: ['COMPLETED', 'CANCELLED'] } };

    const [overdue, dueToday, dueFollowUps, highPriority, upcoming] = await Promise.all([
      taskRepository.findMany({ where: { ...activeWhere, dueDate: { lt: now } }, take: limit, orderBy: { dueDate: 'asc' } }),
      taskRepository.findMany({ where: { ...activeWhere, dueDate: { gte: startOfBusinessDay(now), lte: endOfBusinessDay(now) } }, take: limit, orderBy: { dueDate: 'asc' } }),
      followupService.getDueFollowUps({ userId, limit }),
      taskRepository.findMany({ where: { ...activeWhere, priority: { in: ['HIGH', 'CRITICAL'] }, dueDate: null }, take: limit, orderBy: { createdAt: 'desc' } }),
      taskRepository.findMany({ where: { ...activeWhere, dueDate: { gt: endOfBusinessDay(now), lte: endOfBusinessDay(addBusinessDaysUTC(now, 7)) } }, take: limit, orderBy: { dueDate: 'asc' } }),
    ]);

    // Merge + de-duplicate + rank: overdue first, then due-today, high-priority, follow-up-due, upcoming.
    const seen = new Set();
    const queue = [];
    const push = (task, reason) => {
      if (!task || seen.has(task.id)) return;
      seen.add(task.id);
      queue.push({ ...taskService.serializeTask(task, now), queueReason: reason });
    };
    overdue.forEach((t) => push(t, 'OVERDUE'));
    dueToday.forEach((t) => push(t, 'DUE_TODAY'));
    highPriority.forEach((t) => push(t, 'HIGH_PRIORITY'));
    upcoming.forEach((t) => push(t, 'UPCOMING'));
    dueFollowUps.items.forEach((f) => {
      if (f.task && !seen.has(f.task.id)) {
        seen.add(f.task.id);
        queue.push({ ...f.task, queueReason: 'FOLLOW_UP_DUE' });
      }
    });

    return { queue: queue.slice(0, limit), generatedAt: now.toISOString() };
  },

  // Deadline board sections (Deadlines page).
  async getDeadlineBoard(userId) {
    const now = new Date();
    const activeWhere = { createdById: userId, status: { notIn: ['COMPLETED', 'CANCELLED'] } };

    const [overdue, dueToday, thisWeek, later] = await Promise.all([
      taskRepository.findMany({ where: { ...activeWhere, dueDate: { lt: startOfBusinessDay(now) } }, orderBy: { dueDate: 'asc' }, take: 50 }),
      taskRepository.findMany({ where: { ...activeWhere, dueDate: { gte: startOfBusinessDay(now), lte: endOfBusinessDay(now) } }, orderBy: { dueDate: 'asc' }, take: 50 }),
      taskRepository.findMany({ where: { ...activeWhere, dueDate: { gt: endOfBusinessDay(now), lte: endOfBusinessDay(addBusinessDaysUTC(now, 7)) } }, orderBy: { dueDate: 'asc' }, take: 50 }),
      taskRepository.findMany({ where: { ...activeWhere, dueDate: { gt: endOfBusinessDay(addBusinessDaysUTC(now, 7)) } }, orderBy: { dueDate: 'asc' }, take: 50 }),
    ]);

    return {
      overdue: overdue.map((t) => taskService.serializeTask(t, now)),
      dueToday: dueToday.map((t) => taskService.serializeTask(t, now)),
      thisWeek: thisWeek.map((t) => taskService.serializeTask(t, now)),
      later: later.map((t) => taskService.serializeTask(t, now)),
    };
  },

  // Follow-ups page sections.
  async getFollowUpBoard(userId) {
    const now = new Date();
    const due = await followupService.getDueFollowUps({ userId, limit: 50 });
    const upcoming = await followupService.getUpcomingFollowUps({ userId, limit: 50 });
    return { due: due.items, upcoming };
  },
};

module.exports = { dashboardService };
