import prisma from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';

export class CreditNoteRepository {
  static async findMany(where = {}) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.creditNote.findMany({
          where,
          include: {
            customer: true,
            invoice: true,
            salesOrder: true,
            lines: true,
            payments: true
          },
          orderBy: { createdAt: 'desc' }
        });
      } catch (e) {
        console.error('Error fetching credit notes:', e);
        return [];
      }
    }
    return [];
  }

  static async findById(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.creditNote.findUnique({
          where: { id },
          include: {
            customer: true,
            invoice: true,
            salesOrder: { include: { lines: true } },
            lines: true,
            payments: true
          }
        });
      } catch (e) {
        console.error('Error fetching credit note:', e);
        return null;
      }
    }
    return null;
  }

  static async create(data: any) {
    const { lines, ...cnData } = data;

    if (cnData.invoiceId === "") cnData.invoiceId = null;
    if (cnData.salesOrderId === "") cnData.salesOrderId = null;

    if (SYSTEM_MODE === "LIVE") {
      return await prisma.creditNote.create({
        data: {
          ...cnData,
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
          customer: true
        }
      });
    }
    return { ...data, id: `offline-${Date.now()}` };
  }

  static async update(id: string, data: any) {
    const { lines, ...cnData } = data;

    if (cnData.invoiceId === "") cnData.invoiceId = null;
    if (cnData.salesOrderId === "") cnData.salesOrderId = null;
    if (cnData.dueDate === "" || cnData.dueDate === undefined) cnData.dueDate = null;

    if (SYSTEM_MODE === "LIVE") {
      if (lines) {
        await prisma.creditNoteLine.deleteMany({ where: { creditNoteId: id } });
      }

      const updateData: any = { ...cnData };
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

      return await prisma.creditNote.update({
        where: { id },
        data: updateData,
        include: { lines: true, customer: true }
      });
    }
    return null;
  }

  static async delete(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      return await prisma.creditNote.delete({ where: { id } });
    }
    return null;
  }
}