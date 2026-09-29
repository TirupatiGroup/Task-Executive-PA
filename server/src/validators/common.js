// Validators shared helpers.

const { z } = require('zod');

const cuidString = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid id format');

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const isoDate = z.string().datetime({ offset: true }).or(z.string().min(10)).refine((v) => !Number.isNaN(Date.parse(v)), {
  message: 'Invalid date',
});

module.exports = { z, cuidString, paginationQuery, isoDate };
