import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { ValidationError, NotFoundError, ForbiddenError } from '../../middleware/errorHandler';

export class BillsController {
  async getBills(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const bills = await prisma.bill.findMany({
      where: { companyId },
      include: { vendor: true, payments: { select: { id: true, amount: true, status: true, date: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ success: true, data: bills });
  }

  async getBill(request: FastifyRequest, reply: FastifyReply) {
    const { billId } = request.params as { billId: string };
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: { vendor: true, payments: true },
    });
    if (!bill) throw new NotFoundError('Bill not found');
    return reply.send({ success: true, data: bill });
  }

  async createBill(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { vendorId, subtotal, taxAmount, dueDate, description } = request.body as any;

    if (!vendorId) throw new ValidationError('Vendor is required');
    if (!subtotal || Number(subtotal) <= 0) throw new ValidationError('Subtotal must be a positive number');

    const sub = Number(subtotal);
    const tax = Number(taxAmount || 0);
    const billNumber = `BILL-${companyId.slice(0, 6).toUpperCase()}-${Date.now()}`;

    const bill = await prisma.bill.create({
      data: {
        billNumber,
        companyId,
        vendorId,
        subtotal: sub,
        taxAmount: tax,
        total: sub + tax,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        status: 'DRAFT',
      },
      include: { vendor: true },
    });

    return reply.status(201).send({ success: true, data: bill });
  }

  async updateBill(request: FastifyRequest, reply: FastifyReply) {
    const { billId } = request.params as { billId: string };
    const { vendorId, subtotal, taxAmount, dueDate, status } = request.body as any;

    const existing = await prisma.bill.findUnique({ where: { id: billId } });
    if (!existing) throw new NotFoundError('Bill not found');
    if (existing.status === 'PAID') throw new ForbiddenError('Cannot edit a paid bill');
    if (existing.status === 'APPROVED' && status !== 'PAID') {
      throw new ForbiddenError('Approved bills can only be marked PAID via a payment');
    }

    const sub = subtotal != null ? Number(subtotal) : existing.subtotal;
    const tax = taxAmount != null ? Number(taxAmount) : existing.taxAmount;

    const bill = await prisma.bill.update({
      where: { id: billId },
      data: {
        vendorId: vendorId ?? existing.vendorId,
        subtotal: sub,
        taxAmount: tax,
        total: sub + tax,
        dueDate: dueDate ? new Date(dueDate) : existing.dueDate,
        status: status ?? existing.status,
      },
      include: { vendor: true },
    });

    return reply.send({ success: true, data: bill });
  }

  async deleteBill(request: FastifyRequest, reply: FastifyReply) {
    const { billId } = request.params as { billId: string };
    const existing = await prisma.bill.findUnique({ where: { id: billId } });
    if (!existing) throw new NotFoundError('Bill not found');
    if (existing.status !== 'DRAFT') throw new ForbiddenError('Only DRAFT bills can be deleted');
    await prisma.bill.delete({ where: { id: billId } });
    return reply.send({ success: true, message: 'Bill deleted successfully' });
  }

  async approveBill(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, billId } = request.params as { id: string; billId: string };
    const userId = (request.user as any).id;

    const bill = await prisma.bill.findUnique({ where: { id: billId }, include: { vendor: true } });
    if (!bill) throw new NotFoundError('Bill not found');
    if (bill.status !== 'DRAFT') throw new ForbiddenError(`Cannot approve bill with status: ${bill.status}`);

    const updated = await prisma.$transaction(async (tx: any) => {
      const b = await tx.bill.update({ where: { id: billId }, data: { status: 'APPROVED' } });

      // Auto-journal: Dr Expense / Cr Accounts Payable
      const apAccount = await tx.account.findFirst({ where: { companyId, category: 'AP' } });
      const expAccount = await tx.account.findFirst({ where: { companyId, category: 'EXPENSE' } });

      if (apAccount && expAccount) {
        const entryNumber = `JV-BILL-${billId.slice(0, 8)}`;
        const existing = await tx.journalEntry.findFirst({ where: { entryNumber, companyId } });
        if (existing) await tx.journalEntry.delete({ where: { id: existing.id } });

        await tx.journalEntry.create({
          data: {
            entryNumber,
            companyId,
            date: new Date(),
            description: `Auto-journal: Bill ${bill.billNumber}`,
            reference: bill.billNumber,
            totalDebit: Number(bill.total),
            totalCredit: Number(bill.total),
            status: 'APPROVED',
            createdById: userId,
            approvedById: userId,
            approvedAt: new Date(),
            lines: {
              create: [
                { accountId: expAccount.id, debit: Number(bill.total), credit: 0, debitBase: Number(bill.total), creditBase: 0 },
                { accountId: apAccount.id, debit: 0, credit: Number(bill.total), debitBase: 0, creditBase: Number(bill.total) },
              ],
            },
          },
        });

        await tx.account.update({ where: { id: expAccount.id }, data: { currentBalance: { increment: Number(bill.total) } } });
        await tx.account.update({ where: { id: apAccount.id }, data: { currentBalance: { increment: Number(bill.total) } } });
      }

      return b;
    });

    return reply.send({ success: true, data: updated });
  }
}
