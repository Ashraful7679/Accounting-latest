import prisma from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';

export class SalesOrderRepository {
  static async findMany(options: {
    companyId: string;
    page?: number;
    limit?: number;
    currency?: string;
    search?: string;
    status?: string;
  }) {
    const { companyId, page = 1, limit = 20, currency, search, status } = options;
    
    const where: any = { companyId, deletedAt: null };
    if (currency) where.currency = currency;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { soNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const skip = (page - 1) * limit;

    if (SYSTEM_MODE === "LIVE") {
      try {
        const [data, total] = await Promise.all([
          prisma.salesOrder.findMany({
            where,
            include: {
              customer: true,
              lc: true,
              lines: { include: { product: true } },
              dns: { include: { lines: true } },
              invoices: { include: { lines: true } },
              purchaseOrders: { include: { supplier: true } },
              pis: { select: { id: true, piNumber: true, status: true } }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          }),
          prisma.salesOrder.count({ where })
        ]);

        return {
          data,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          }
        };
      } catch (e) {
        console.error('Error fetching sales orders:', e);
        return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      }
    }
    return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
  }

  static async findById(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.salesOrder.findFirst({
          where: { id, deletedAt: null },
          include: {
            customer: true,
            lc: true,
            lines: {
              include: { product: true }
            },
            dns: {
              include: { lines: true }
            },
            invoices: {
              include: { lines: true }
            },
            purchaseOrders: {
              include: {
                supplier: true
              }
            },
            pis: {
              select: { id: true, piNumber: true, status: true }
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
            create: lines.map((l: any) => ({
              productId: l.productId,
              itemDescription: l.itemDescription || l.description || '',
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              total: l.total
            }))
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
          create: lines.map((l: any) => ({
            productId: l.productId,
            itemDescription: l.itemDescription || l.description || '',
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            total: l.total
          }))
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
      return await prisma.salesOrder.update({
        where: { id },
        data: { deletedAt: new Date() }
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
