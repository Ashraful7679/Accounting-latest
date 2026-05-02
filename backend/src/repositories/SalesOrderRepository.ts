import prisma from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';

export class SalesOrderRepository {
  static async findMany(where = {}) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.salesOrder.findMany({
          where,
          include: {
            customer: true,
            lc: true,
            lines: true,
            purchaseOrders: {
              include: {
                supplier: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        });
      } catch (e) {
        console.error('Error fetching sales orders:', e);
        return [];
      }
    }
    return [];
  }

  static async findById(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.salesOrder.findUnique({
          where: { id },
          include: {
            customer: true,
            lc: true,
            lines: true,
            purchaseOrders: {
              include: {
                supplier: true
              }
            }
          }
        });
      } catch (e) {
        console.error('Error fetching sales order:', e);
        return null;
      }
    }
    return null;
  }

  static async create(data: any) {
    const { lines, purchaseOrderIds, ...soData } = data;
    
    if (soData.lcId === "") soData.lcId = null;

    if (SYSTEM_MODE === "LIVE") {
      return await prisma.salesOrder.create({
        data: {
          ...soData,
          lines: {
            create: lines
          },
          purchaseOrders: purchaseOrderIds ? {
            connect: purchaseOrderIds.map((id: string) => ({ id }))
          } : undefined
        },
        include: {
          lines: true,
          customer: true,
          lc: true,
          purchaseOrders: true
        }
      });
    }
    return { ...data, id: `offline-${Date.now()}` };
  }

  static async update(id: string, data: any) {
    const { lines, purchaseOrderIds, ...soData } = data;
    
    if (soData.lcId === "") soData.lcId = null;
    if (soData.expectedDeliveryDate === "" || soData.expectedDeliveryDate === undefined) {
      soData.expectedDeliveryDate = null;
    }

    if (SYSTEM_MODE === "LIVE") {
      const updatePayload: any = { ...soData };

      if (lines) {
        await prisma.salesOrderLine.deleteMany({
          where: { salesOrderId: id }
        });
        updatePayload.lines = {
          create: lines
        };
      }

      if (purchaseOrderIds) {
        updatePayload.purchaseOrders = {
          set: purchaseOrderIds.map((pid: string) => ({ id: pid }))
        };
      }

      return await prisma.salesOrder.update({
        where: { id },
        data: updatePayload,
        include: {
          lines: true,
          customer: true,
          lc: true,
          purchaseOrders: true
        }
      });
    }
    return { ...data, id };
  }

  static async delete(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      return await prisma.salesOrder.delete({
        where: { id }
      });
    }
    return { id };
  }

  static async assignPurchaseOrder(soId: string, poId: string) {
    return await prisma.salesOrder.update({
      where: { id: soId },
      data: {
        purchaseOrders: {
          connect: { id: poId }
        }
      },
      include: {
        purchaseOrders: true
      }
    });
  }

  static async unassignPurchaseOrder(soId: string, poId: string) {
    return await prisma.salesOrder.update({
      where: { id: soId },
      data: {
        purchaseOrders: {
          disconnect: { id: poId }
        }
      },
      include: {
        purchaseOrders: true
      }
    });
  }
}
