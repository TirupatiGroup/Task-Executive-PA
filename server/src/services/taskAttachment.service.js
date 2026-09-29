// TaskAttachment service - CRUD and business rules for task attachments.

const { prisma } = require('../config/database');
const { activityRepository } = require('../repositories/activity.repository');
const { NotFoundError, ForbiddenError, ValidationError } = require('../utils/errors');

const MAX_SAFE_INT = 2000000000;

function serializeAttachment(attachment) {
  if (!attachment) return attachment;
  return {
    id: attachment.id,
    taskId: attachment.taskId,
    fileName: attachment.fileName,
    storedName: attachment.storedName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    kind: attachment.kind,
    createdAt: attachment.createdAt,
    url: `/uploads/tasks/${attachment.storedName}`,
  };
}

function determineKind(mimeType, originalname) {
  if (mimeType.startsWith('image/')) {
    const name = originalname || '';
    if (/screenshot|screen|snip|clip/i.test(name)) return 'SCREENSHOT';
    return 'IMAGE';
  }
  return 'FILE';
}

const taskAttachmentService = {
  serializeAttachment,

  async createAttachment({ taskId, userId, file }) {
    if (!file) throw new ValidationError('No file provided');

    const sizeBytes = Number(file.size);
    if (!Number.isInteger(sizeBytes) || sizeBytes < 0 || sizeBytes > MAX_SAFE_INT) {
      throw new ValidationError('Invalid file size');
    }

    const kind = determineKind(file.mimetype, file.originalname);

    const created = await prisma.taskAttachment.create({
      data: {
        taskId,
        fileName: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        sizeBytes,
        kind,
        createdById: userId,
      },
    });

    return serializeAttachment(created);
  },

  async listAttachments(taskId) {
    const rows = await prisma.taskAttachment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(serializeAttachment);
  },

  async getAttachment(id) {
    const row = await prisma.taskAttachment.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Attachment not found');
    return serializeAttachment(row);
  },

  async deleteAttachment(id, userId) {
    const existing = await prisma.taskAttachment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Attachment not found');
    if (existing.createdById !== userId) throw new ForbiddenError('Cannot delete attachment created by another user');

    const deleted = await prisma.taskAttachment.delete({ where: { id } });

    await activityRepository.create({
      entityType: 'TASK',
      entityId: existing.taskId,
      action: 'DELETE',
      summary: `Deleted attachment "${existing.fileName}"`,
      metadata: { attachmentId: id, fileName: existing.fileName },
      createdById: userId,
    });

    return serializeAttachment(deleted);
  },
};

module.exports = { taskAttachmentService };
