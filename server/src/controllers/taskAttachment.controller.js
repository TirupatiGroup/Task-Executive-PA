// TaskAttachment controllers - thin; delegate to services.

const { asyncHandler, success } = require('../utils/response');
const { taskAttachmentService } = require('../services/taskAttachment.service');
const { uploadSingle } = require('../middleware/upload');
const { ValidationError } = require('../utils/errors');

const uploadAttachment = [
  uploadSingle,
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError('File is required');
    const attachment = await taskAttachmentService.createAttachment({
      taskId: req.params.id,
      userId: req.user.id,
      file: req.file,
    });
    return success(res, { message: 'Attachment uploaded', data: { attachment }, status: 201 });
  }),
];

const listAttachments = asyncHandler(async (req, res) => {
  const attachments = await taskAttachmentService.listAttachments(req.params.id);
  return success(res, { message: 'Attachments fetched', data: { attachments } });
});

const deleteAttachment = asyncHandler(async (req, res) => {
  await taskAttachmentService.deleteAttachment(req.params.attachmentId, req.user.id);
  return success(res, { message: 'Attachment deleted' });
});

module.exports = { uploadAttachment, listAttachments, deleteAttachment };
