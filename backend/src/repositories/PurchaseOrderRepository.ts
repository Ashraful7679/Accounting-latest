import prisma from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';

export class PurchaseOrderRepository {
  static async findMany(where = {}) {
    if (SYSTEM_MODE === "LIVE") {
      return await prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: true,
          lc: true,
          lines: true
        },
        orderBy: { createdAt: 'desc' }
      });
    }
    return []; // Return empty for mock for now
  }

  static async findById(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      return await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          supplier: true,
          lc: true,
          lines: true
        }
      });
    }
    return null;
  }

  static async create(data: any) {
    const { lines, ...poData } = data;
    
    // Ensure empty relation IDs are treated as null
    if (poData.lcId === "") {
      poData.lcId = null;
    }

    if (SYSTEM_MODE === "LIVE") {
      return await prisma.purchaseOrder.create({
        data: {
          ...poData,
          lines: {
            create: lines
          }
        },
        include: {
          lines: true
        }
      });
    }
    return { ...data, id: `offline-${Date.now()}` };
  }

  static async update(id: string, data: any) {
    const { lines, ...poData } = data;
    
    // Ensure empty relation IDs are treated as null
    if (poData.lcId === "") {
      poData.lcId = null;
    }

    if (SYSTEM_MODE === "LIVE") {
      // For updates, we might want to replace lines or update them individually.
      // Simplest: Delete and recreate lines if provided
      if (lines) {
        await prisma.purchaseOrderLine.deleteMany({
          where: { purchaseOrderId: id }
        });
        return await prisma.purchaseOrder.update({
          where: { id },
          data: {
            ...poData,
            lines: {
              create: lines
            }
          },
          include: {
            lines: true
          }
        });
      }

      return await prisma.purchaseOrder.update({
        where: { id },
        data: poData,
        include: {
          lines: true
        }
      });
    }
    return { ...data, id };
  }

  static async delete(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      return await prisma.purchaseOrder.delete({
        where: { id }
      });
    }
    return { id };
  }
}
