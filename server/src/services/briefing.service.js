// Briefing service - daily summary of meetings, tasks, follow-ups, overdue.
// Used by the in-app daily briefing card (Phase 5) and the voice briefing (Phase 6).

const { calendarService } = require('./calendar.service');
const { taskService } = require('./task.service');
const { followupService } = require('./followup.service');
const { formatBusiness } = require('../utils/dates');

const briefingService = {
  async getTodayBriefing(userId) {
    const now = new Date();
    const [meetings, taskSummary, dueFollowUps, deadlineBoard, recentlyCompleted] = await Promise.all([
      calendarService.getTodayMeetings(userId, { limit: 10 }),
      taskService.getTaskSummary(userId),
      followupService.getDueFollowUps({ userId, limit: 10 }),
      (async () => {
        const { dashboardService } = require('./dashboard.service');
        return dashboardService.getDeadlineBoard(userId);
      })(),
      taskService.getRecentlyCompleted(userId, 5),
    ]);

    const overdue = deadlineBoard.overdue || [];
    const dueToday = deadlineBoard.dueToday || [];

    const lines = [];
    lines.push(meetings.count > 0
      ? `You have ${meetings.count} meeting${meetings.count === 1 ? '' : 's'} today.`
      : 'No meetings today.');
    if (meetings.events.length) {
      const first = meetings.events[0];
      lines.push(`Your first meeting is ${first.subject || 'a meeting'} at ${formatBusiness(first.startAt, 'h:mm a')}.`);
    }
    lines.push(`You have ${taskSummary.active} active task${taskSummary.active === 1 ? '' : 's'} and ${dueToday.length} due today.`);
    if (overdue.length) lines.push(`${overdue.length} task${overdue.length === 1 ? ' is' : 's are'} overdue.`);
    if (dueFollowUps.items.length) lines.push(`${dueFollowUps.items.length} follow-up${dueFollowUps.items.length === 1 ? '' : 's'} need attention today.`);

    return {
      date: formatBusiness(now, 'EEEE, dd MMMM yyyy'),
      summary: lines.join(' '),
      meetings: meetings.events,
      nextMeeting: meetings.next,
      taskSummary,
      dueToday,
      overdue,
      dueFollowUps: dueFollowUps.items,
      recentlyCompleted,
      generatedAt: now.toISOString(),
    };
  },
};

module.exports = { briefingService };
