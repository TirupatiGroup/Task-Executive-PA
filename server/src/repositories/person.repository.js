// Person repository - owns all database queries for people.

const { prisma } = require('../config/database');

const personRepository = {
  async create(data, tx = prisma) {
    return tx.person.create({ data });
  },

  async findById(id, tx = prisma) {
    return tx.person.findUnique({ where: { id } });
  },

  async findMany({ where = {}, skip = 0, take = 20, orderBy = { name: 'asc' } }, tx = prisma) {
    return tx.person.findMany({ where, skip, take, orderBy });
  },

  async count(where = {}, tx = prisma) {
    return tx.person.count({ where });
  },

  async update(id, data, tx = prisma) {
    return tx.person.update({ where: { id }, data });
  },

  async countActiveTasks(personId, tx = prisma) {
    return tx.task.count({
      where: { assigneeId: personId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    });
  },
};

module.exports = { personRepository };
