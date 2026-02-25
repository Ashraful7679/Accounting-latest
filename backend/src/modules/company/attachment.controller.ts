import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { NotFoundError, ValidationError } from '../../middleware/errorHandler';

export class AttachmentController {
  private readonly UPLOAD_DIR = path.join(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.UPLOAD_DIR)) {
      fs.mkdirSync(this.UPLOAD_DIR, { recursive: true });
    }
  }

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
        const folderPath = path.join(this.UPLOAD_DIR, relativeDir);
        
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }

        const fileName = `${Date.now()}-${part.filename}`;
        const filePath = path.join(folderPath, fileName);
        const relativeFilePath = path.join(relativeDir, fileName);

        // Use stream to calculate hash and save file
        const hash = crypto.createHash('sha256');
        const writeStream = fs.createWriteStream(filePath);
        
        let fileSize = 0;
        
        // Pipeline handles the streaming properly
        await pipeline(part.file, async function* (source) {
          for await (const chunk of source) {
            fileSize += chunk.length;
            hash.update(chunk);
            yield chunk;
          }
        }, writeStream);

        const hashValue = hash.digest('hex');

        // Create DB record using the new Attachment model
        uploadedAttachment = await prisma.attachment.create({
          data: {
            name: part.filename,
            fileName: fileName,
            fileType: part.mimetype,
            filePath: relativeFilePath,
            fileSize: fileSize,
            entityType: entityType.toUpperCase(),
            entityId: entityId,
            documentType: documentType || 'GENERAL',
            hashValue: hashValue,
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
    const { id: attachmentId } = request.params as { id: string };

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId, isActive: true }
    });

    if (!attachment) {
      throw new NotFoundError('Attachment not found');
    }

    // Permission Verification
    // Secure serving logic: verify if the user has access to the company context
    // This part will be expanded once we have a more granular permission service.
    
    const filePath = path.join(this.UPLOAD_DIR, attachment.filePath.replace(/\\/g, path.sep).replace(/\//g, path.sep));
    if (!fs.existsSync(filePath)) {
      throw new NotFoundError(`Physical file not found on disk: ${attachment.filePath}`);
    }

    // Stream the file for performance and security
    const stream = fs.createReadStream(filePath);
    reply.header('Content-Type', attachment.fileType);
    reply.header('Content-Disposition', `inline; filename="${attachment.name}"`);
    return reply.send(stream);
  }

  async listByEntity(request: FastifyRequest, reply: FastifyReply) {
    const { type: entityType, id: entityId } = request.params as { type: string, id: string };

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

    // Soft delete as per RMG audit requirements
    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { isActive: false }
    });

    return reply.send({ success: true, message: 'Attachment removed successfully' });
  }
}
