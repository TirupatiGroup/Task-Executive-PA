// Search service - private cross-entity search with validated, parameterized queries.

const { prisma } = require('../config/database');
const { taskService } = require('./task.service');

const MAX_QUERY_LEN = 80;

const searchService = {
  async globalSearch(userId, rawQuery, { limit = 10 } = {}) {
    const q = String(rawQuery || '').trim().slice(0, MAX_QUERY_LEN);
    if (!q) {
      return { query: '', tasks: [], people: [], followUps: [], total: 0 };
    }

    const [tasks, people, followUps] = await Promise.all([
      prisma.task.findMany({
        where: {
          createdById: userId,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: { assignee: { select: { id: true, name: true } } },
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.person.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { department: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.followUp.findMany({
        where: {
          note: { contains: q, mode: 'insensitive' },
          task: { createdById: userId },
        },
        include: { task: { select: { id: true, title: true, status: true } } },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const serialized = tasks.map((t) => taskService.serializeTask(t));
    const total = serialized.length + people.length + followUps.length;
    return { query: q, tasks: serialized, people, followUps, total };
  },
};

module.exports = { searchService, MAX_QUERY_LEN };
