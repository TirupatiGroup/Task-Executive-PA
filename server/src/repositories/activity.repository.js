// ActivityLog repository.

const { prisma } = require('../config/database');

const activityRepository = {
  async create(data, tx = prisma) {
    return tx.activityLog.create({ data });
  },

  async createMany(dataArray, tx = prisma) {
    return tx.activityLog.createMany({ data: dataArray });
  },

  async findMany({ where = {}, skip = 0, take = 20, orderBy = { createdAt: 'desc' } }, tx = prisma) {
    return tx.activityLog.findMany({ where, skip, take, orderBy });
  },

  async count(where = {}, tx = prisma) {
    return tx.activityLog.count({ where });
  },
};

module.exports = { activityRepository };
