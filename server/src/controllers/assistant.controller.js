// Assistant controller.

const { asyncHandler, success } = require('../utils/response');
const { assistantService } = require('../services/assistant.service');

const { z } = require('zod');

const querySchema = z.object({
  text: z.string().min(1).max(500),
});

const actionSchema = z.object({
  action: z.enum(['COMPLETE_TASK', 'REOPEN_TASK', 'CANCEL_TASK']),
  taskId: z.string().min(1).max(64),
  confirmToken: z.string().optional(),
});

const capabilities = asyncHandler(async (req, res) => {
  const data = assistantService.capabilities();
  return success(res, { message: 'Assistant capabilities', data });
});

const query = asyncHandler(async (req, res) => {
  const parsed = querySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ success: false, message: 'Validation failed', errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) });
  }
  const data = await assistantService.handleQuery(req.user.id, parsed.data.text);
  return success(res, { message: 'Assistant response', data });
});

const prepareAction = asyncHandler(async (req, res) => {
  const parsed = actionSchema.omit({ confirmToken: true }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ success: false, message: 'Validation failed', errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) });
  }
  const data = await assistantService.prepareAction(req.user.id, parsed.data);
  return success(res, { message: 'Action prepared', data });
});

const executeAction = asyncHandler(async (req, res) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ success: false, message: 'Validation failed', errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) });
  }
  const data = await assistantService.executeAction(req.user.id, parsed.data);
  return success(res, { message: 'Action executed', data });
});

module.exports = { capabilities, query, prepareAction, executeAction };
