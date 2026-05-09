import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import path from 'path';
import { NotFoundError, ValidationError } from '../../middleware/errorHandler';
import { saveFile, getFile } from '../../lib/storage';

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

        const relativeDir = path.join('transactions', entityType.toLowerCase(), entityId);
        const fileName = `${Date.now()}-${part.filename}`;
        const relativeFilePath = path.join(relativeDir, fileName);

        const result = await saveFile(relativeFilePath, part.file, part.mimetype);

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

    const file = await getFile(attachment.filePath.replace(/\\/g, '/'));
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
    const { id: attachmentId } = request.params as { id: string };

    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { isActive: false }
    });

    return reply.send({ success: true, message: 'Attachment removed successfully' });
  }
}
