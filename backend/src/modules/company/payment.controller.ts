import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler';

export class PaymentController {
  async createPayment(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request.user as any).id;

    if (!data.amount || data.amount <= 0) {
      throw new ValidationError('Valid payment amount is required');
    }

    const { invoiceId, billId, accountId, date, amount, method, reference, description } = data;

    const payment = await prisma.$transaction(async (tx) => {
      // 1. Create the Payment record
      const pmt = await (tx as any).payment.create({
        data: {
          paymentNumber: `PAY-${Date.now()}`, // Temporary numbering, use a generator in production
          companyId,
          date: date ? new Date(date) : new Date(),
          amount: Number(amount),
          method,
          reference,
          description,
          invoiceId,
          billId,
          accountId,
          status: 'APPROVED'
        }
      });

      // 2. Generate Journal Entry for the Payment
      // Debit Cash/Bank, Credit AR (if Invoice)
      // Debit AP, Credit Cash/Bank (if Bill)
      
      const pmtDate = date ? new Date(date) : new Date();

      if (invoiceId) {
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) throw new NotFoundError('Invoice not found');

        // Logic for Customer Payment (Receipt)
        // Find AR and Cash/Bank accounts
        const arAccount = await tx.account.findFirst({
            where: { companyId, category: 'AR' } as any
        });
        
        if (!accountId || !arAccount) {
            throw new ValidationError('Settlement accounts (AR/Cash) not found');
        }

        await tx.journalEntry.create({
          data: {
            entryNumber: `JV-PMT-${pmt.id.substring(0,8)}`,
            companyId,
            date: pmtDate,
            description: `Payment received for Invoice ${invoice.invoiceNumber}`,
            totalDebit: Number(amount),
            totalCredit: Number(amount),
            status: 'APPROVED',
            createdById: userId,
            approvedById: userId,
            approvedAt: new Date(),
            lines: {
              create: [
                { accountId: accountId, debit: Number(amount), credit: 0, debitBase: Number(amount), creditBase: 0 },
                { accountId: arAccount.id, debit: 0, credit: Number(amount), debitBase: 0, creditBase: Number(amount) }
              ]
            }
          }
        });

        // Update balances
        await tx.account.update({ where: { id: accountId }, data: { currentBalance: { increment: Number(amount) } } });
        await tx.account.update({ where: { id: arAccount.id }, data: { currentBalance: { decrement: Number(amount) } } });
      }

      return pmt;
    });

    return reply.status(201).send({ success: true, data: payment });
  }

  async listPayments(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const payments = await (prisma as any).payment.findMany({
      where: { companyId },
      include: { invoice: true, bill: true, account: true },
      orderBy: { date: 'desc' }
    });
    return reply.send({ success: true, data: payments });
  }
}
