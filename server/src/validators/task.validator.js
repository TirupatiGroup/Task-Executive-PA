// Zod validators for task routes (query whitelist + ids).

const { z, cuidString, paginationQuery } = require('./common');

const TASK_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'WAITING', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];
const TASK_TYPES = ['PERSONAL', 'ASSIGNED'];

const idParams = z.object({ id: z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format') });

const taskQuery = paginationQuery.extend({
  taskType: z.enum(TASK_TYPES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeId: cuidString.optional(),
  search: z.string().max(120).optional(),
  sortBy: z.enum(['dueDate', 'createdAt', 'priority', 'updatedAt']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  dueToday: z.enum(['true', 'false']).optional(),
  overdue: z.enum(['true', 'false']).optional(),
  upcoming: z.enum(['true', 'false']).optional(),
  completed: z.enum(['true', 'false']).optional(),
  active: z.enum(['true', 'false']).optional(),
});

const createTaskBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  taskType: z.enum(TASK_TYPES).optional(),
  assigneeId: cuidString.nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  assignedDate: z.string().datetime({ offset: true }).nullable().optional(),
  startDate: z.string().datetime({ offset: true }).nullable().optional(),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
});

const updateTaskBody = createTaskBody.partial().omit({ status: true });

const statusBody = z.object({ status: z.enum(TASK_STATUSES) });

const followUpBody = z.object({
  note: z.string().min(1).max(2000),
  followUpAt: z.string().datetime({ offset: true }).optional(),
  nextFollowUpAt: z.string().datetime({ offset: true }).nullable().optional(),
});

module.exports = { idParams, taskQuery, createTaskBody, updateTaskBody, statusBody, followUpBody, TASK_STATUSES, TASK_PRIORITIES, TASK_TYPES };
