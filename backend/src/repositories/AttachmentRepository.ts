import prisma from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';

export class AttachmentRepository {
  static async createAttachment(data: any) {
    if (SYSTEM_MODE === "LIVE") {
      return await prisma.attachment.create({
        data
      });
    }
    // For offline mode, we just return the data with a mock ID
    return {
      id: `offline-att-${Date.now()}`,
      ...data,
      createdAt: new Date().toISOString()
    };
  }

  static async findByEntity(entityType: string, entityId: string) {
    if (SYSTEM_MODE === "LIVE") {
      return await prisma.attachment.findMany({
        where: {
          entityType,
          entityId,
          isActive: true
        },
        orderBy: { createdAt: 'desc' }
      });
    }
    return [];
  }

  static async deleteAttachment(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      return await prisma.attachment.update({
        where: { id },
        data: { isActive: false }
      });
    }
    return { id, isActive: false };
  }
}
