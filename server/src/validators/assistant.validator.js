// Assistant validators.

const { z } = require('./common');

const queryBody = z.object({
  text: z.string().min(1).max(500),
});

const prepareBody = z.object({
  action: z.enum(['COMPLETE_TASK', 'REOPEN_TASK', 'CANCEL_TASK']),
  taskId: z.string().min(1).max(64),
});

const executeBody = z.object({
  action: z.enum(['COMPLETE_TASK', 'REOPEN_TASK', 'CANCEL_TASK']),
  taskId: z.string().min(1).max(64),
  confirmToken: z.string().min(10).max(1024),
});

module.exports = { queryBody, prepareBody, executeBody };
