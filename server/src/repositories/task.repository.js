// Task repository - owns all database queries for tasks.

const { prisma } = require('../config/database');

const INCLUDE_DETAIL = {
  assignee: true,
  followUps: { orderBy: { followUpAt: 'desc' } },
  attachments: { orderBy: { createdAt: 'desc' } },
};

const taskRepository = {
  async create(data, tx = prisma) {
    return tx.task.create({ data, include: { assignee: true } });
  },

  async findById(id, tx = prisma) {
    return tx.task.findUnique({ where: { id }, include: INCLUDE_DETAIL });
  },

  async findByIdWithActivity(id, tx = prisma) {
    return tx.task.findUnique({
      where: { id },
      include: {
        assignee: true,
        followUps: { orderBy: { followUpAt: 'desc' }, include: { creator: { select: { displayName: true, email: true } } } },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    });
  },

  async findMany({ where = {}, skip = 0, take = 20, orderBy = { createdAt: 'desc' } }, tx = prisma) {
    return tx.task.findMany({
      where, skip, take, orderBy,
      include: { assignee: true, attachments: { orderBy: { createdAt: 'desc' } } },
    });
  },

  async count(where = {}, tx = prisma) {
    return tx.task.count({ where });
  },

  async update(id, data, tx = prisma) {
    return tx.task.update({ where: { id }, data, include: { assignee: true } });
  },

  async groupCount(where, groupBy, tx = prisma) {
    return tx.task.groupBy({
      by: [groupBy],
      where,
      _count: { _all: true },
    });
  },
};

module.exports = { taskRepository, INCLUDE_DETAIL };
