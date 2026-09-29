// Notification repository.
//
// NOTE: All Prisma .upsert() calls have been replaced with manual
// check-then-create-or-update patterns because Prisma upsert() requires
// a MongoDB replica set (transactions), while many local/Windows MongoDB
// installs run as standalone. The dedupe-key uniqueness is still enforced
// by the database-level unique index on (userId, dedupeKey); we catch the
// duplicate-key error and fall back to update() to retain idempotency.

const { Prisma } = require('@prisma/client');
const { prisma } = require('../config/database');

const notificationRepository = {
  async create(data, tx = prisma) {
    return tx.notification.create({ data });
  },

  // Idempotent create-or-update using unique (userId, dedupeKey).
  // Replaces Prisma upsert() for standalone MongoDB compatibility.
  async upsertByDedupeKey(data, tx = prisma) {
    const { userId, dedupeKey } = data;
    if (!userId || !dedupeKey) {
      throw new Error('upsertByDedupeKey requires userId and dedupeKey');
    }
    const updateData = {
      title: data.title,
      body: data.body,
      severity: data.severity,
      scheduledFor: data.scheduledFor,
    };
    // Try fast-path find-then-act
    const existing = await tx.notification.findUnique({
      where: { userId_dedupeKey: { userId, dedupeKey } },
      select: { id: true },
    });
    if (existing) {
      return tx.notification.update({
        where: { id: existing.id },
        data: updateData,
      });
    }
    try {
      return await tx.notification.create({ data });
    } catch (err) {
      // Unique violation: concurrent create won the race — fall back to update.
      const isDupe =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002';
      if (isDupe) {
        return tx.notification.update({
          where: { userId_dedupeKey: { userId, dedupeKey } },
          data: updateData,
        });
      }
      throw err;
    }
  },

  async findMany({ where = {}, skip = 0, take = 20, orderBy = { createdAt: 'desc' } }, tx = prisma) {
    return tx.notification.findMany({ where, skip, take, orderBy });
  },

  async count(where = {}, tx = prisma) {
    return tx.notification.count({ where });
  },

  async findById(id, tx = prisma) {
    return tx.notification.findUnique({ where: { id } });
  },

  async update(id, data, tx = prisma) {
    return tx.notification.update({ where: { id }, data });
  },

  async markAllRead(userId, tx = prisma) {
    return tx.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  },
};

module.exports = { notificationRepository };
