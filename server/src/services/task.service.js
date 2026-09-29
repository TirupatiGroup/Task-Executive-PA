// Task service - business rules: status transitions, overdue derivation, assignment rules.

const { taskRepository } = require('../repositories/task.repository');
const { personRepository } = require('../repositories/person.repository');
const { activityRepository } = require('../repositories/activity.repository');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { endOfBusinessDay, addBusinessDaysUTC } = require('../utils/dates');
const { taskAttachmentService } = require('./taskAttachment.service');

const TASK_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'WAITING', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];
const TASK_TYPES = ['PERSONAL', 'ASSIGNED'];

// Allowed status transitions (business rules).
const ALLOWED_TRANSITIONS = {
  NOT_STARTED: ['IN_PROGRESS', 'WAITING', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['WAITING', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'NOT_STARTED'],
  WAITING: ['IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['IN_PROGRESS'], // controlled reopen
  CANCELLED: ['NOT_STARTED'], // controlled reopen from cancel
};

function validateTaskInput(data, { partial = false } = {}) {
  const errors = [];
  const clean = {};

  if (!partial || data.title !== undefined) {
    if (typeof data.title !== 'string' || !data.title.trim()) {
      errors.push({ field: 'title', message: 'Title is required' });
    } else if (data.title.trim().length > 200) {
      errors.push({ field: 'title', message: 'Title must be at most 200 characters' });
    } else clean.title = data.title.trim();
  }

  if (data.description !== undefined) {
    if (data.description === null || data.description === '') clean.description = null;
    else if (typeof data.description !== 'string' || data.description.length > 5000) {
      errors.push({ field: 'description', message: 'Description must be at most 5000 characters' });
    } else clean.description = data.description.trim();
  }

  if (data.taskType !== undefined) {
    if (!TASK_TYPES.includes(data.taskType)) errors.push({ field: 'taskType', message: 'Invalid task type' });
    else clean.taskType = data.taskType;
  }

  if (data.priority !== undefined) {
    if (!TASK_PRIORITIES.includes(data.priority)) errors.push({ field: 'priority', message: 'Invalid priority' });
    else clean.priority = data.priority;
  }

  if (data.status !== undefined) {
    if (!TASK_STATUSES.includes(data.status)) errors.push({ field: 'status', message: 'Invalid status' });
    else clean.status = data.status;
  }

  const dateFields = ['assignedDate', 'startDate', 'dueDate'];
  for (const f of dateFields) {
    if (data[f] !== undefined) {
      if (data[f] === null || data[f] === '') { clean[f] = null; continue; }
      const d = new Date(data[f]);
      if (Number.isNaN(d.getTime())) errors.push({ field: f, message: `Invalid date for ${f}` });
      else clean[f] = d;
    }
  }

  if (data.assigneeId !== undefined) {
    if (data.assigneeId === null || data.assigneeId === '') clean.assigneeId = null;
    else if (typeof data.assigneeId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(data.assigneeId)) {
      errors.push({ field: 'assigneeId', message: 'Invalid assignee id' });
    } else clean.assigneeId = data.assigneeId;
  }

  if (errors.length) throw new ValidationError('Task validation failed', errors);
  return clean;
}

// Derived overdue: has dueDate in the past, and not COMPLETED/CANCELLED.
function deriveOverdue(task, now = new Date()) {
  if (!task || !task.dueDate) return false;
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return false;
  return new Date(task.dueDate).getTime() < endOfBusinessDay(now).getTime()
    && new Date(task.dueDate).getTime() < now.getTime();
}

function serializeTask(task, now = new Date()) {
  if (!task) return task;
  const serialized = {
    ...task,
    isOverdue: deriveOverdue(task, now),
  };
  if (Array.isArray(task.attachments)) {
    serialized.attachments = task.attachments.map(taskAttachmentService.serializeAttachment);
  }
  return serialized;
}

const taskService = {
  TASK_STATUSES,
  TASK_PRIORITIES,
  TASK_TYPES,
  ALLOWED_TRANSITIONS,
  deriveOverdue,
  serializeTask,
  validateTaskInput,

  buildTaskWhere(filters = {}) {
    const where = {};
    if (filters.taskType) where.taskType = filters.taskType;
    if (filters.status) where.status = filters.status;
    if (filters.statusIn) where.status = { in: filters.statusIn };
    if (filters.priority) where.priority = filters.priority;
    if (filters.priorityIn) where.priority = { in: filters.priorityIn };
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters.search && typeof filters.search === 'string' && filters.search.trim()) {
      where.title = { contains: filters.search.trim(), mode: 'insensitive' };
    }
    // Deadline windows (business-day anchored, computed centrally).
    const now = new Date();
    if (filters.dueToday) {
      where.dueDate = { gte: endOfBusinessDay(addBusinessDaysUTC(now, -1)), lte: endOfBusinessDay(now) };
    }
    if (filters.overdue === 'true' || filters.overdue === true) {
      where.dueDate = { lt: new Date() };
      where.status = { notIn: ['COMPLETED', 'CANCELLED'] };
    }
    if (filters.upcoming === 'true' || filters.upcoming === true) {
      where.dueDate = { gte: now };
      where.status = { notIn: ['COMPLETED', 'CANCELLED'] };
    }
    if (filters.completed === 'true' || filters.completed === true) {
      where.status = 'COMPLETED';
    }
    if (filters.active === 'true' || filters.active === true) {
      where.status = { notIn: ['COMPLETED', 'CANCELLED'] };
    }
    return where;
  },

  buildTaskOrderBy(sortBy, sortDir) {
    const allowed = { dueDate: 'dueDate', createdAt: 'createdAt', priority: 'priority', updatedAt: 'updatedAt' };
    const dir = sortDir === 'asc' ? 'asc' : 'desc';
    const field = allowed[sortBy] || 'createdAt';
    return { [field]: dir };
  },

  async listTasks(filters, { page = 1, limit = 20 } = {}) {
    const where = taskService.buildTaskWhere(filters);
    const [tasks, total] = await Promise.all([
      taskRepository.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: taskService.buildTaskOrderBy(filters.sortBy, filters.sortDir) }),
      taskRepository.count(where),
    ]);
    const now = new Date();
    return { tasks: tasks.map((t) => serializeTask(t, now)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  },

  async getTaskDetail(id) {
    const task = await taskRepository.findByIdWithActivity(id);
    if (!task) throw new NotFoundError('Task not found');
    return serializeTask(task);
  },

  async createTask(data, userId) {
    const clean = taskService.validateTaskInput(data);

    if (clean.taskType === 'ASSIGNED') {
      if (!clean.assigneeId) throw new ValidationError('Assigned task requires an assignee', [{ field: 'assigneeId', message: 'Assignee is required for ASSIGNED tasks' }]);
      const person = await personRepository.findById(clean.assigneeId);
      if (!person) throw new ValidationError('Assignee not found', [{ field: 'assigneeId', message: 'Assignee does not exist' }]);
      if (!person.isActive) throw new ValidationError('Assignee is inactive', [{ field: 'assigneeId', message: 'Cannot assign tasks to an inactive person' }]);
    } else if (clean.taskType === 'PERSONAL') {
      if (clean.assigneeId) throw new ValidationError('Personal task must not have an assignee', [{ field: 'assigneeId', message: 'Personal tasks cannot have an assignee' }]);
    } else if (!clean.taskType) {
      clean.taskType = clean.assigneeId ? 'ASSIGNED' : 'PERSONAL';
      if (clean.taskType === 'ASSIGNED') {
        const person = await personRepository.findById(clean.assigneeId);
        if (!person || !person.isActive) throw new ValidationError('Invalid assignee', [{ field: 'assigneeId', message: 'Assignee must be an active person' }]);
      }
    }

    if (clean.startDate && clean.dueDate && clean.dueDate < clean.startDate) {
      throw new ValidationError('Due date cannot be before start date', [{ field: 'dueDate', message: 'Due date must be on or after start date' }]);
    }

    const status = clean.status || 'NOT_STARTED';
    const task = await taskRepository.create({
      title: clean.title,
      description: clean.description ?? null,
      taskType: clean.taskType,
      assigneeId: clean.taskType === 'PERSONAL' ? null : clean.assigneeId ?? null,
      priority: clean.priority || 'NORMAL',
      status,
      assignedDate: clean.taskType === 'ASSIGNED' ? (clean.assignedDate || new Date()) : (clean.assignedDate ?? null),
      startDate: clean.startDate ?? null,
      dueDate: clean.dueDate ?? null,
      completedAt: status === 'COMPLETED' ? new Date() : null,
      createdById: userId,
    });

    await activityRepository.create({
      entityType: 'TASK',
      entityId: task.id,
      action: 'CREATE',
      summary: `Created ${clean.taskType.toLowerCase()} task "${task.title}"`,
      metadata: { priority: task.priority, status: task.status },
      createdById: userId,
    });

    return serializeTask(task);
  },

  async updateTask(id, data, userId) {
    const existing = await taskRepository.findById(id);
    if (!existing) throw new NotFoundError('Task not found');
    const clean = taskService.validateTaskInput(data, { partial: true });

    // Assignee validation when changing assignee or type.
    if (clean.assigneeId !== undefined || clean.taskType !== undefined) {
      const effectiveType = clean.taskType || existing.taskType;
      const effectiveAssignee = clean.assigneeId !== undefined ? clean.assigneeId : existing.assigneeId;
      if (effectiveType === 'PERSONAL' && effectiveAssignee) {
        throw new ValidationError('Personal task must not have an assignee', [{ field: 'assigneeId', message: 'Personal tasks cannot have an assignee' }]);
      }
      if (effectiveType === 'ASSIGNED') {
        if (!effectiveAssignee) throw new ValidationError('Assigned task requires an assignee', [{ field: 'assigneeId', message: 'Assignee is required' }]);
        const person = await personRepository.findById(effectiveAssignee);
        if (!person || !person.isActive) throw new ValidationError('Invalid assignee', [{ field: 'assigneeId', message: 'Assignee must be an active person' }]);
      }
    }

    if (clean.startDate && clean.dueDate) {
      const start = clean.startDate || existing.startDate;
      const due = clean.dueDate || existing.dueDate;
      if (start && due && due < start) {
        throw new ValidationError('Due date cannot be before start date', [{ field: 'dueDate', message: 'Due date must be on or after start date' }]);
      }
    }

    // completedAt is controlled by the status-transition service, not by the client.
    delete clean.status;
    delete clean.completedAt;

    const task = await taskRepository.update(id, clean);
    await activityRepository.create({
      entityType: 'TASK',
      entityId: id,
      action: 'UPDATE',
      summary: `Updated task "${task.title}"`,
      createdById: userId,
    });
    return serializeTask(task);
  },

  async changeStatus(id, status, userId) {
    const existing = await taskRepository.findById(id);
    if (!existing) throw new NotFoundError('Task not found');
    if (!TASK_STATUSES.includes(status)) {
      throw new ValidationError('Invalid status', [{ field: 'status', message: 'Unknown status' }]);
    }
    const allowed = ALLOWED_TRANSITIONS[existing.status] || [];
    if (!allowed.includes(status)) {
      throw new ValidationError(`Cannot transition from ${existing.status} to ${status}`);
    }

    const data = { status };
    if (status === 'COMPLETED') data.completedAt = new Date();
    if (existing.status === 'COMPLETED' && status === 'IN_PROGRESS') data.completedAt = null; // controlled reopen

    const task = await taskRepository.update(id, data);
    const action = status === 'COMPLETED' ? 'COMPLETE' : (existing.status === 'COMPLETED' ? 'REOPEN' : (status === 'CANCELLED' ? 'CANCEL' : 'STATUS_CHANGE'));
    await activityRepository.create({
      entityType: 'TASK',
      entityId: id,
      action,
      summary: `Task "${task.title}" moved from ${existing.status} to ${status}`,
      metadata: { from: existing.status, to: status },
      createdById: userId,
    });
    return serializeTask(task);
  },

  // Dashboard-oriented queries, executed server-side.
  async getTaskSummary(userId) {
    const now = new Date();
    const activeWhere = { createdById: userId, status: { notIn: ['COMPLETED', 'CANCELLED'] } };

    const [total, active, completed, overdue, dueToday, highPriority] = await Promise.all([
      taskRepository.count({ createdById: userId }),
      taskRepository.count(activeWhere),
      taskRepository.count({ createdById: userId, status: 'COMPLETED' }),
      taskRepository.count({ ...activeWhere, dueDate: { lt: now } }),
      taskRepository.count({ ...activeWhere, dueDate: { gte: endOfBusinessDay(addBusinessDaysUTC(now, -1)), lte: endOfBusinessDay(now) } }),
      taskRepository.count({ ...activeWhere, priority: { in: ['HIGH', 'CRITICAL'] } }),
    ]);

    return { total, active, completed, overdue, dueToday, highPriority };
  },

  async getRecentlyCompleted(userId, limit = 5) {
    const tasks = await taskRepository.findMany(
      { where: { createdById: userId, status: 'COMPLETED' }, take: limit, orderBy: { completedAt: 'desc' } },
    );
    return tasks;
  },
};

module.exports = { taskService };
