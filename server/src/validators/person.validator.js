// Zod validators for people routes.

const { z, cuidString, paginationQuery } = require('./common');

const idParams = z.object({ id: cuidString });

const personQuery = paginationQuery.extend({
  isActive: z.enum(['true', 'false']).optional(),
  search: z.string().max(120).optional(),
});

const createPersonBody = z.object({
  name: z.string().min(1).max(120),
  designation: z.string().max(120).nullable().optional(),
  department: z.string().max(120).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  isActive: z.boolean().optional(),
});

const updatePersonBody = createPersonBody.partial();

const statusBody = z.object({ isActive: z.boolean() });

module.exports = { idParams, personQuery, createPersonBody, updatePersonBody, statusBody };
