// FollowUp service - chronological follow-up entries and due-follow-up logic.

const { followupRepository } = require('../repositories/followup.repository');
const { taskRepository } = require('../repositories/task.repository');
const { activityRepository } = require('../repositories/activity.repository');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { endOfBusinessDay } = require('../utils/dates');

function validateFollowUpInput(data) {
  const errors = [];
  const clean = {};

  if (typeof data.note !== 'string' || !data.note.trim()) {
    errors.push({ field: 'note', message: 'Follow-up note is required' });
  } else if (data.note.trim().length > 2000) {
    errors.push({ field: 'note', message: 'Note must be at most 2000 characters' });
  } else clean.note = data.note.trim();

  if (data.followUpAt !== undefined && data.followUpAt !== null && data.followUpAt !== '') {
    const d = new Date(data.followUpAt);
    if (Number.isNaN(d.getTime())) errors.push({ field: 'followUpAt', message: 'Invalid follow-up date' });
    else clean.followUpAt = d;
  }

  if (data.nextFollowUpAt !== undefined && data.nextFollowUpAt !== null && data.nextFollowUpAt !== '') {
    const d = new Date(data.nextFollowUpAt);
    if (Number.isNaN(d.getTime())) errors.push({ field: 'nextFollowUpAt', message: 'Invalid next follow-up date' });
    else clean.nextFollowUpAt = d;
  } else {
    clean.nextFollowUpAt = null;
  }

  if (errors.length) throw new ValidationError('Follow-up validation failed', errors);
  return clean;
}

const followupService = {
  validateFollowUpInput,

  async addFollowUp(taskId, data, userId) {
    const task = await taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task not found');

    const clean = followupService.validateFollowUpInput(data);

    const followUp = await followupRepository.create({
      taskId,
      followUpAt: clean.followUpAt || new Date(),
      note: clean.note,
      nextFollowUpAt: clean.nextFollowUpAt,
      createdById: userId,
    });

    // Latest nextFollowUpAt drives the task's next-follow-up pointer (derived, not stored on task).
    await activityRepository.create({
      entityType: 'FOLLOW_UP',
      entityId: followUp.id,
      action: 'FOLLOW_UP_ADD',
      summary: `Follow-up added to task "${task.title}"`,
      metadata: { taskId, note: clean.note.slice(0, 120) },
      createdById: userId,
    });

    return followUp;
  },

  async listTaskFollowUps(taskId) {
    const task = await taskRepository.findById(taskId);
    if (!task) throw new NotFoundError('Task not found');
    return followupRepository.findManyByTask(taskId, { orderBy: { followUpAt: 'asc' } });
  },

  // Follow-ups requiring attention: task active and the latest planned
  // next-follow-up time has arrived (or is due today).
  async getDueFollowUps({ userId, page = 1, limit = 20 } = {}) {
    const now = new Date();
    const where = {
      nextFollowUpAt: { lte: endOfBusinessDay(now) },
      task: { createdById: userId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    };
    const [items, total] = await Promise.all([
      followupRepository.findMany({ where, skip: (page - 1) * limit, take: limit }),
      followupRepository.count(where),
    ]);
    return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  },

  async getUpcomingFollowUps({ userId, limit = 10 } = {}) {
    const now = new Date();
    const where = {
      nextFollowUpAt: { gt: endOfBusinessDay(now) },
      task: { createdById: userId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    };
    return followupRepository.findMany({ where, take: limit, orderBy: { nextFollowUpAt: 'asc' } });
  },
};

module.exports = { followupService };
