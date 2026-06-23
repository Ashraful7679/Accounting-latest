import prisma from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';

export class PurchaseOrderRepository {
  static async findMany(options: {
    companyId: string;
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) {
    const { companyId, page = 1, limit = 20, search, status } = options;
    
    const where: any = { companyId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { poNumber: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const skip = (page - 1) * limit;

    if (SYSTEM_MODE === "LIVE") {
      try {
        const [data, total] = await Promise.all([
          prisma.purchaseOrder.findMany({
            where,
            include: {
              supplier: true,
              lc: true,
              lines: true,
              grns: { include: { lines: true } },
              invoices: { include: { lines: true } },
              salesOrders: true,
              purchaseRequisitions: true
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          }),
          prisma.purchaseOrder.count({ where })
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
        console.error('Error fetching purchase orders:', e);
        return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      }
    }
    return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
  }

  static async findById(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.purchaseOrder.findUnique({
          where: { id },
          include: {
            supplier: true,
            lc: true,
            lines: true,
            grns: {
              include: { lines: true }
            },
            invoices: {
              include: { lines: true }
            },
            salesOrders: true,
            purchaseRequisitions: true
          }
        });
      } catch (e) {
        console.error('Error fetching purchase order:', e);
        return null;
      }
    }
    return null;
  }

  static async create(data: any) {
    const { lines, purchaseRequisitionIds, ...poData } = data;
    
    // Ensure empty relation IDs are treated as null
    if (poData.lcId === "") {
      poData.lcId = null;
    }

    if (SYSTEM_MODE === "LIVE") {
      const connectPRs = purchaseRequisitionIds && Array.isArray(purchaseRequisitionIds)
        ? { connect: purchaseRequisitionIds.map((id: string) => ({ id })) }
        : undefined;

      return await prisma.purchaseOrder.create({
        data: {
          ...poData,
          purchaseRequisitions: connectPRs,
          lines: {
            create: lines.map((l: any) => ({
              productId: l.productId,
              itemDescription: l.itemDescription || l.description || '',
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              total: l.total
            }))
          }
        },
        include: {
          lines: true,
          supplier: true,
          lc: true,
          purchaseRequisitions: true
        }
      });
    }
    return { ...data, id: `offline-${Date.now()}` };
  }

  static async update(id: string, data: any) {
    const { lines, purchaseRequisitionIds, ...poData } = data;
    
    // Ensure empty relation IDs are treated as null
    if (poData.lcId === "") {
      poData.lcId = null;
    }
    // Ensure empty date fields are treated as null (Prisma requires DateTime or null)
    if (poData.expectedDeliveryDate === "" || poData.expectedDeliveryDate === undefined) {
      poData.expectedDeliveryDate = null;
    }

    if (SYSTEM_MODE === "LIVE") {
      const setPRs = purchaseRequisitionIds && Array.isArray(purchaseRequisitionIds)
        ? { set: purchaseRequisitionIds.map((id: string) => ({ id })) }
        : undefined;

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
            purchaseRequisitions: setPRs,
            lines: {
              create: lines.map((l: any) => ({
                productId: l.productId,
                itemDescription: l.itemDescription || l.description || '',
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                total: l.total
              }))
            }
          },
          include: {
            lines: true,
            supplier: true,
            lc: true,
            purchaseRequisitions: true
          }
        });
      }

      return await prisma.purchaseOrder.update({
        where: { id },
        data: {
          ...poData,
          purchaseRequisitions: setPRs
        },
        include: {
          lines: true,
          supplier: true,
          lc: true,
          purchaseRequisitions: true
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

  static async assignSalesOrder(poId: string, soId: string, action: 'connect' | 'disconnect') {
    if (SYSTEM_MODE === "LIVE") {
      return await prisma.purchaseOrder.update({
        where: { id: poId },
        data: {
          salesOrders: {
            [action === 'connect' ? 'connect' : 'disconnect']: { id: soId }
          }
        }
      });
    }
    return { poId, soId, action };
  }
}
