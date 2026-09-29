// Generic Zod validation middleware for body/params/query.

const { ValidationError } = require('../utils/errors');

function parse(section, schema, value) {
  if (!schema) return value;
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.issues.map((i) => ({
      field: [section, ...i.path].join('.'),
      message: i.message,
    })));
  }
  return result.data;
}

function validate({ body, params, query } = {}) {
  return (req, res, next) => {
    try {
      if (body) req.body = parse('body', body, req.body || {});
      if (params) req.params = parse('params', params, req.params || {});
      if (query) req.query = parse('query', query, req.query || {});
      next();
    } catch (err) {
      next(err);
    }
  };
}

const validateBody = (schema) => validate({ body: schema });
const validateParams = (schema) => validate({ params: schema });
const validateQuery = (schema) => validate({ query: schema });

module.exports = { validate, validateBody, validateParams, validateQuery };
