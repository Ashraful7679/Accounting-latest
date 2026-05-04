import prisma from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';

export class DebitNoteRepository {
  static async findMany(where = {}) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.debitNote.findMany({
          where,
          include: {
            vendor: true,
            bill: true,
            purchaseOrder: true,
            lines: true,
            payments: true
          },
          orderBy: { createdAt: 'desc' }
        });
      } catch (e) {
        console.error('Error fetching debit notes:', e);
        return [];
      }
    }
    return [];
  }

  static async findById(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.debitNote.findUnique({
          where: { id },
          include: {
            vendor: true,
            bill: true,
            purchaseOrder: {
              include: { lines: true }
            },
            lines: true,
            payments: true
          }
        });
      } catch (e) {
        console.error('Error fetching debit note:', e);
        return null;
      }
    }
    return null;
  }

  static async create(data: any) {
    const { lines, ...dnData } = data;

    // Ensure empty relation IDs are treated as null
    if (dnData.billId === "") dnData.billId = null;
    if (dnData.purchaseOrderId === "") dnData.purchaseOrderId = null;

    if (SYSTEM_MODE === "LIVE") {
      return await prisma.debitNote.create({
        data: {
          ...dnData,
          lines: {
            create: lines?.map((l: any) => ({
              productId: l.productId,
              description: l.description || l.itemDescription || '',
              quantity: l.quantity,
              unitPrice: l.unitPrice || 0,
              taxRate: l.taxRate || 0,
              taxAmount: l.taxAmount || 0,
              amount: l.amount || (l.quantity * l.unitPrice)
            })) || []
          }
        },
        include: {
          lines: true,
          vendor: true
        }
      });
    }
    return { ...data, id: `offline-${Date.now()}` };
  }

  static async update(id: string, data: any) {
    const { lines, ...dnData } = data;

    if (dnData.billId === "") dnData.billId = null;
    if (dnData.purchaseOrderId === "") dnData.purchaseOrderId = null;
    if (dnData.dueDate === "" || dnData.dueDate === undefined) dnData.dueDate = null;

    if (SYSTEM_MODE === "LIVE") {
      // If lines provided, delete and recreate
      if (lines) {
        await prisma.debitNoteLine.deleteMany({ where: { debitNoteId: id } });
      }

      const updateData: any = { ...dnData };
      if (lines) {
        updateData.lines = {
          create: lines.map((l: any) => ({
            productId: l.productId,
            description: l.description || l.itemDescription || '',
            quantity: l.quantity,
            unitPrice: l.unitPrice || 0,
            taxRate: l.taxRate || 0,
            taxAmount: l.taxAmount || 0,
            amount: l.amount || (l.quantity * l.unitPrice)
          }))
        };
      }

      return await prisma.debitNote.update({
        where: { id },
        data: updateData,
        include: { lines: true, vendor: true }
      });
    }
    return null;
  }

  static async delete(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      return await prisma.debitNote.delete({ where: { id } });
    }
    return null;
  }
}