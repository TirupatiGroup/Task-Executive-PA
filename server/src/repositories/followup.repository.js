// FollowUp repository - owns all database queries for follow-ups.

const { prisma } = require('../config/database');

const followupRepository = {
  async create(data, tx = prisma) {
    return tx.followUp.create({
      data,
      include: { task: { select: { id: true, title: true, status: true } } },
    });
  },

  async findById(id, tx = prisma) {
    return tx.followUp.findUnique({ where: { id }, include: { task: true } });
  },

  async findManyByTask(taskId, { orderBy = { followUpAt: 'desc' } } = {}, tx = prisma) {
    return tx.followUp.findMany({ where: { taskId }, orderBy });
  },

  async findMany({ where = {}, skip = 0, take = 20, orderBy = { nextFollowUpAt: 'asc' } }, tx = prisma) {
    return tx.followUp.findMany({
      where,
      skip,
      take,
      orderBy,
      include: { task: { select: { id: true, title: true, status: true, priority: true, assignee: { select: { id: true, name: true } } } } },
    });
  },

  async count(where = {}, tx = prisma) {
    return tx.followUp.count({ where });
  },
};

module.exports = { followupRepository };
