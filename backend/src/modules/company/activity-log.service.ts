import prismaBase from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';

const prisma = prismaBase as any;

export class ActivityLogService {
  static async log({
    companyId,
    entityType,
    entityId,
    action,
    performedById,
    targetUserId,
    metadata
  }: {
    companyId: string;
    entityType: string;
    entityId: string;
    action: string;
    performedById: string;
    targetUserId?: string;
    metadata?: any;
  }) {
    if (SYSTEM_MODE !== 'LIVE') return null;

    try {
      return await prisma.activityLog.create({
        data: {
          companyId,
          entityType,
          entityId,
          action,
          performedById,
          targetUserId,
          metadata: metadata || {}
        }
      });
    } catch (error) {
      console.error('Failed to create activity log:', error);
      return null;
    }
  }

  static async getLogs(companyId: string, options: { entityType?: string; entityId?: string; limit?: number } = {}) {
    if (SYSTEM_MODE !== 'LIVE') return [];

    try {
      return await prisma.activityLog.findMany({
        where: {
          companyId,
          entityType: options.entityType,
          entityId: options.entityId,
          deletedAt: null
        },
        include: {
          performedBy: { select: { id: true, name: true, email: true } },
          targetUser: { select: { id: true, name: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50
      });
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
      return [];
    }
  }
}
