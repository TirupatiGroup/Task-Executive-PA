// Reminder repository.

const { prisma } = require('../config/database');

const reminderRepository = {
  async create(data, tx = prisma) {
    return tx.reminder.create({ data });
  },

  async findDue(now, tx = prisma) {
    return tx.reminder.findMany({
      where: {
        isEnabled: true,
        processedAt: null,
        OR: [
          { remindAt: { lte: now }, snoozedUntil: null },
          { snoozedUntil: { lte: now } },
        ],
      },
      include: { task: true },
    });
  },

  async findById(id, tx = prisma) {
    return tx.reminder.findUnique({ where: { id }, include: { task: true } });
  },

  async update(id, data, tx = prisma) {
    return tx.reminder.update({ where: { id }, data });
  },

  async findManyByTask(taskId, tx = prisma) {
    return tx.reminder.findMany({ where: { taskId }, orderBy: { remindAt: 'asc' } });
  },

  async count(where = {}, tx = prisma) {
    return tx.reminder.count({ where });
  },
};

module.exports = { reminderRepository };
