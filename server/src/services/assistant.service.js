// Assistant service - deterministic intent handling over existing domain services.
// No AI model: utterances are normalized and matched to enumerated intents.
// Answers always come from real services; unsupported input gets a safe fallback.

const { calendarService } = require('./calendar.service');
const { taskService } = require('./task.service');
const { followupService } = require('./followup.service');
const { briefingService } = require('./briefing.service');
const { taskRepository } = require('../repositories/task.repository');
const { formatBusiness, addBusinessDaysUTC, startOfBusinessDay, endOfBusinessDay } = require('../utils/dates');
const { ValidationError, NotFoundError } = require('../utils/errors');

const INTENTS = [
  'BRIEFING_TODAY',
  'MEETINGS_TODAY',
  'MEETINGS_TOMORROW',
  'MEETINGS_THIS_WEEK',
  'NEXT_MEETING',
  'TASKS_TODAY',
  'TASKS_OVERDUE',
  'TASKS_HIGH_PRIORITY',
  'TASKS_ASSIGNED',
  'TASKS_COMPLETED_TODAY',
  'FOLLOWUPS_TODAY',
  'FOLLOWUPS_THIS_WEEK',
  'HELP',
];

const ACTIONS = ['COMPLETE_TASK', 'REOPEN_TASK', 'CANCEL_TASK'];

function normalize(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/[?!.]+$/g, '');
}

function parseTaskIdFromText(text) {
  // e.g. "complete task xyz123" - ids are cuid-like [a-z0-9_-]
  const m = text.match(/\b(?:task)\s+([a-z0-9]{6,})\b/i);
  return m ? m[1] : null;
}

const assistantService = {
  INTENTS,
  ACTIONS,

  capabilities() {
    return {
      intents: INTENTS.map((i) => ({ name: i, description: describeIntent(i) })),
      actions: ACTIONS.map((a) => ({ name: a, description: describeAction(a), requiresConfirmation: true })),
      speech: {
        inputSupported: 'browser speech recognition (feature-detected client-side)',
        outputSupported: 'browser speech synthesis (feature-detected client-side)',
      },
    };
  },

  async handleQuery(userId, rawText) {
    const text = normalize(rawText);
    if (!text) {
      return { intent: null, answer: 'Please say or type a command. Try "help" to see what I can do.', data: null, supported: false };
    }

    // Briefing
    if (/(brief|summary|my day|work today|what.*today)/.test(text) && !/meeting/.test(text)) {
      const briefing = await briefingService.getTodayBriefing(userId);
      return { intent: 'BRIEFING_TODAY', answer: briefing.summary, data: briefing, supported: true };
    }

    // Meetings
    if (/(next meeting|upcoming meeting)/.test(text)) {
      const today = await calendarService.getTodayMeetings(userId, { limit: 10 });
      if (!today.next) {
        return { intent: 'NEXT_MEETING', answer: 'You have no more meetings today.', data: { next: null }, supported: true };
      }
      const n = today.next;
      return {
        intent: 'NEXT_MEETING',
        answer: `Your next meeting is ${n.subject || 'unnamed'} at ${formatBusiness(n.startAt, 'h:mm a')}${n.location ? ` in ${n.location}` : ''}.`,
        data: { next: n },
        supported: true,
      };
    }
    if (/meeting/.test(text)) {
      if (/tomorrow/.test(text)) {
        const start = startOfBusinessDay(addBusinessDaysUTC(new Date(), 1));
        const end = endOfBusinessDay(addBusinessDaysUTC(new Date(), 1));
        const events = await calendarService.getEvents(userId, { start: start.toISOString(), end: end.toISOString() });
        return { intent: 'MEETINGS_TOMORROW', answer: describeEvents(events, 'tomorrow'), data: { events }, supported: true };
      }
      if (/this week|week/.test(text)) {
        const start = startOfBusinessDay();
        const end = endOfBusinessDay(addBusinessDaysUTC(new Date(), 7));
        const events = await calendarService.getEvents(userId, { start: start.toISOString(), end: end.toISOString() });
        return { intent: 'MEETINGS_THIS_WEEK', answer: describeEvents(events, 'this week'), data: { events }, supported: true };
      }
      const today = await calendarService.getTodayMeetings(userId, { limit: 10 });
      return { intent: 'MEETINGS_TODAY', answer: describeEvents(today.events, 'today'), data: { events: today.events }, supported: true };
    }

    // Follow-ups
    if (/(follow ?up|followups?)/.test(text)) {
      if (/week/.test(text)) {
        const start = startOfBusinessDay();
        const end = endOfBusinessDay(addBusinessDaysUTC(new Date(), 7));
        const where = {
          nextFollowUpAt: { lte: end },
          task: { createdById: userId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        };
        const items = await followupService.getDueFollowUps({ userId, limit: 20 });
        const names = [...new Set(items.items.map((f) => f.task?.title).filter(Boolean))];
        return {
          intent: 'FOLLOWUPS_THIS_WEEK',
          answer: names.length ? `Follow-ups due this week: ${names.join(', ')}.` : 'No follow-ups due this week.',
          data: { items: items.items },
          supported: true,
        };
      }
      const due = await followupService.getDueFollowUps({ userId, limit: 20 });
      const names = [...new Set(due.items.map((f) => f.task?.title).filter(Boolean))];
      return {
        intent: 'FOLLOWUPS_TODAY',
        answer: names.length ? `You need to follow up on: ${names.join(', ')}.` : 'No follow-ups are due today.',
        data: { items: due.items },
        supported: true,
      };
    }

    // Tasks
    if (/(task|work|deadline|overdue|priority)/.test(text)) {
      if (/(overdue|late)/.test(text)) {
        const { dashboardService } = require('./dashboard.service');
        const board = await dashboardService.getDeadlineBoard(userId);
        const names = board.overdue.map((t) => t.title);
        return { intent: 'TASKS_OVERDUE', answer: names.length ? `Overdue tasks: ${names.join(', ')}.` : 'Nothing is overdue.', data: { tasks: board.overdue }, supported: true };
      }
      if (/(high|critical|urgent|priority)/.test(text)) {
        const { dashboardService } = require('./dashboard.service');
        const summary = await dashboardService.getSummary(userId);
        const names = summary.lists.priorityTasks.map((t) => `${t.title}${t.dueDate ? ` (due ${formatBusiness(t.dueDate, 'dd MMM')})` : ''}`);
        return { intent: 'TASKS_HIGH_PRIORITY', answer: names.length ? `High-priority tasks: ${names.join(', ')}.` : 'No high-priority tasks.', data: { tasks: summary.lists.priorityTasks }, supported: true };
      }
      if (/assigned/.test(text)) {
        const result = await taskService.listTasks({ taskType: 'ASSIGNED', active: 'true' }, { page: 1, limit: 10 });
        const names = result.tasks.map((t) => `${t.title} → ${t.assignee?.name || 'unknown'}`);
        return { intent: 'TASKS_ASSIGNED', answer: names.length ? `Assigned work: ${names.join(', ')}.` : 'No active assigned tasks.', data: { tasks: result.tasks }, supported: true };
      }
      if (/completed|done/.test(text)) {
        const recent = await taskService.getRecentlyCompleted(userId, 5);
        const names = recent.map((t) => t.title);
        return { intent: 'TASKS_COMPLETED_TODAY', answer: names.length ? `Recently completed: ${names.join(', ')}.` : 'No recently completed tasks.', data: { tasks: recent }, supported: true };
      }
      // Default: today's tasks
      const { dashboardService } = require('./dashboard.service');
      const board = await dashboardService.getDeadlineBoard(userId);
      const names = board.dueToday.map((t) => t.title);
      return { intent: 'TASKS_TODAY', answer: names.length ? `Due today: ${names.join(', ')}.` : 'No tasks are due today.', data: { tasks: board.dueToday }, supported: true };
    }

    // Help
    if (/help|what can you do|commands/.test(text)) {
      return { intent: 'HELP', answer: describeHelp(), data: assistantService.capabilities(), supported: true };
    }

    return {
      intent: null,
      answer: 'Sorry, I did not understand that. Try "what is my work today", "what meetings does Dr. Singh have today", or "help".',
      data: null,
      supported: false,
    };
  },

  // Stage 1: prepare a state-changing action; returns a confirmation token.
  async prepareAction(userId, { action, taskId }) {
    if (!ACTIONS.includes(action)) throw new ValidationError('Unsupported action');
    if (!taskId) throw new ValidationError('taskId is required');
    const task = await taskRepository.findById(taskId);
    if (!task || task.createdById !== userId) throw new NotFoundError('Task not found');

    const validFrom = {
      COMPLETE_TASK: ['NOT_STARTED', 'IN_PROGRESS', 'WAITING', 'ON_HOLD'],
      REOPEN_TASK: ['COMPLETED'],
      CANCEL_TASK: ['NOT_STARTED', 'IN_PROGRESS', 'WAITING', 'ON_HOLD'],
    };
    if (!validFrom[action].includes(task.status)) {
      throw new ValidationError(`Cannot ${action} a task in status ${task.status}`);
    }

    // Confirmation token encodes intent; short-lived, signed by JWT_SECRET.
    const jwt = require('jsonwebtoken');
    const { env } = require('../config/env');
    const confirmToken = jwt.sign({ sub: userId, action, taskId }, env.JWT_SECRET, { expiresIn: '10m' });
    return {
      action,
      task: { id: task.id, title: task.title, status: task.status },
      confirmToken,
      message: `Confirm: ${describeAction(action)} "${task.title}"?`,
    };
  },

  // Stage 2: execute only with a valid confirmation token.
  async executeAction(userId, { action, taskId, confirmToken }) {
    if (!ACTIONS.includes(action)) throw new ValidationError('Unsupported action');
    if (!confirmToken) throw new ValidationError('Confirmation required for this action');

    const jwt = require('jsonwebtoken');
    const { env } = require('../config/env');
    let decoded;
    try {
      decoded = jwt.verify(confirmToken, env.JWT_SECRET);
    } catch {
      throw new ValidationError('Confirmation expired or invalid. Please confirm again.');
    }
    if (decoded.sub !== userId || decoded.action !== action || decoded.taskId !== taskId) {
      throw new ValidationError('Confirmation does not match this action');
    }

    const statusMap = { COMPLETE_TASK: 'COMPLETED', REOPEN_TASK: 'IN_PROGRESS', CANCEL_TASK: 'CANCELLED' };
    const task = await taskService.changeStatus(taskId, statusMap[action], userId);
    return { task, message: `Done. Task "${task.title}" is now ${task.status.replace('_', ' ').toLowerCase()}.` };
  },
};

function describeEvents(events, when) {
  if (!events.length) return `No meetings ${when}.`;
  const parts = events.slice(0, 5).map((e) => `${e.subject || 'a meeting'} at ${formatBusiness(e.startAt, 'h:mm a')}`);
  const more = events.length > 5 ? ` and ${events.length - 5} more` : '';
  return `You have ${events.length} meeting${events.length === 1 ? '' : 's'} ${when}: ${parts.join(', ')}${more}.`;
}

function describeIntent(intent) {
  const map = {
    BRIEFING_TODAY: 'Daily summary of meetings, tasks, deadlines and follow-ups',
    MEETINGS_TODAY: "List today's meetings",
    MEETINGS_TOMORROW: "List tomorrow's meetings",
    MEETINGS_THIS_WEEK: 'List this week\'s meetings',
    NEXT_MEETING: 'Next upcoming meeting today',
    TASKS_TODAY: 'Tasks due today',
    TASKS_OVERDUE: 'Overdue tasks',
    TASKS_HIGH_PRIORITY: 'High and critical priority tasks',
    TASKS_ASSIGNED: 'Active assigned tasks',
    TASKS_COMPLETED_TODAY: 'Recently completed tasks',
    FOLLOWUPS_TODAY: 'Follow-ups due today',
    FOLLOWUPS_THIS_WEEK: 'Follow-ups due this week',
    HELP: 'List supported commands',
  };
  return map[intent] || intent;
}

function describeAction(action) {
  const map = { COMPLETE_TASK: 'Mark task complete', REOPEN_TASK: 'Reopen task', CANCEL_TASK: 'Cancel task' };
  return map[action] || action;
}

function describeHelp() {
  return 'You can ask: what is my work today; what meetings do I have today/tomorrow/this week; what is my next meeting; what tasks are overdue; what are my high priority tasks; who do I need to follow up with; and briefing. To complete a task say: complete task <task id>.';
}

module.exports = { assistantService };
