// Activity service - paginated, filterable business history.

const { activityRepository } = require('../repositories/activity.repository');

const ENTITY_TYPES = ['TASK', 'PERSON', 'FOLLOW_UP', 'CALENDAR', 'NOTIFICATION'];
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'COMPLETE', 'REOPEN', 'CANCEL', 'FOLLOW_UP_ADD', 'ARCHIVE', 'RESTORE', 'ASSIGN', 'LOGIN', 'SYNC'];

const activityService = {
  async listActivity({ entityType, action, entityId, page = 1, limit = 20 }) {
    const where = {};
    if (entityType && ENTITY_TYPES.includes(entityType)) where.entityType = entityType;
    if (action && ACTIONS.includes(action)) where.action = action;
    if (entityId) where.entityId = entityId;

    const [items, total] = await Promise.all([
      activityRepository.findMany({ where, skip: (page - 1) * limit, take: limit }),
      activityRepository.count(where),
    ]);
    return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  },
};

module.exports = { activityService, ENTITY_TYPES, ACTIONS };
