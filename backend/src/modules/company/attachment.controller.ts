import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import path from 'path';
import { NotFoundError, ValidationError, ForbiddenError } from '../../middleware/errorHandler';
import { saveFile, getFile, deleteFile } from '../../lib/storage';

export class AttachmentController {
  async upload(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const parts = request.parts();
    
    let uploadedAttachment = null;

    for await (const part of parts) {
      if (part.type === 'file') {
        const query = request.query as any;
        const entityType = query.entityType;
        const entityId = query.entityId;
        const documentType = query.documentType;
        
        if (!entityType || !entityId) {
          throw new ValidationError('entityType and entityId are required in query params');
        }

        // Restrictions: max 10MB, PDF/JPG/PNG/CSV
        const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'text/csv'];
        if (!allowedMimes.includes(part.mimetype)) {
          throw new ValidationError('Invalid file type. Only PDF, JPG, PNG, and CSV are allowed.');
        }

        const relativeDir = path.join('transactions', entityType.toLowerCase(), entityId);
        const fileName = `${Date.now()}-${part.filename}`;
        const relativeFilePath = path.join(relativeDir, fileName).replace(/\\/g, '/');

        const result = await saveFile(relativeFilePath, part.file, part.mimetype);

        // Check size after streaming
        if (result.fileSize > 10 * 1024 * 1024) {
          await deleteFile(relativeFilePath);
          throw new ValidationError('File size exceeds the 10MB limit.');
        }

        uploadedAttachment = await prisma.attachment.create({
          data: {
            name: part.filename,
            fileName: fileName,
            fileType: part.mimetype,
            filePath: relativeFilePath,
            fileSize: result.fileSize,
            entityType: entityType.toUpperCase(),
            entityId: entityId,
            documentType: documentType || 'GENERAL',
            hashValue: result.hash,
            uploadedById: (request.user as any).id,
          }
        });
      }
    }

    if (!uploadedAttachment) {
      throw new ValidationError('No file was uploaded');
    }

    return reply.send({ success: true, data: uploadedAttachment });
  }

  async getSecureFile(request: FastifyRequest, reply: FastifyReply) {
    const { attachmentId } = request.params as { attachmentId: string };

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId, isActive: true }
    });

    if (!attachment) {
      throw new NotFoundError('Attachment not found');
    }

    const file = await getFile(attachment.filePath);
    if (!file) {
      throw new NotFoundError(`File not found: ${attachment.filePath}`);
    }

    reply.header('Content-Type', attachment.fileType);
    reply.header('Content-Disposition', `inline; filename="${attachment.name}"`);
    return reply.send(file.stream);
  }

  async listByEntity(request: FastifyRequest, reply: FastifyReply) {
    const { type: entityType, entityId } = request.params as { type: string, entityId: string };

    const attachments = await prisma.attachment.findMany({
      where: {
        entityType: entityType.toUpperCase(),
        entityId: entityId,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ success: true, data: attachments });
  }

  async deleteAttachment(request: FastifyRequest, reply: FastifyReply) {
    const { attachmentId } = request.params as { attachmentId: string };
    const userId = (request.user as any).id;

    const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) throw new NotFoundError('Attachment not found');

    // Basic permission: only uploader can delete
    if (attachment.uploadedById !== userId) {
      throw new ForbiddenError('You can only delete your own attachments');
    }

    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { isActive: false }
    });

    return reply.send({ success: true, message: 'Attachment removed successfully' });
  }
}
