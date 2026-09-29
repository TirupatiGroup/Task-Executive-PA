// Validators for search and activity routes.

const { z, paginationQuery } = require('./common');

const searchQuery = z.object({
  q: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(25).optional(),
});

const ACTIVITY_ENTITY_TYPES = ['TASK', 'PERSON', 'FOLLOW_UP', 'CALENDAR', 'NOTIFICATION'];
const ACTIVITY_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'COMPLETE', 'REOPEN', 'CANCEL', 'FOLLOW_UP_ADD', 'ARCHIVE', 'RESTORE', 'ASSIGN', 'LOGIN', 'SYNC'];

const activityQuery = paginationQuery.extend({
  entityType: z.enum(ACTIVITY_ENTITY_TYPES).optional(),
  action: z.enum(ACTIVITY_ACTIONS).optional(),
  entityId: z.string().max(64).optional(),
});

module.exports = { searchQuery, activityQuery };
