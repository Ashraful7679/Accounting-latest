import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler';
import { NotificationController } from './notification.controller';
import { TransactionRepository } from '../../repositories/TransactionRepository';

export class PaymentController {
  async createPayment(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request.user as any).id;

    if (!data.amount || data.amount <= 0) {
      throw new ValidationError('Valid payment amount is required');
    }

    const { invoiceId, billId, lcId, piAllocations, accountId, date, amount, method, reference, description } = data;

    const paymentDate = date ? new Date(date) : new Date();
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } }
    });
    const isOwnerOrAdmin = userRecord?.userRoles.some((ur: any) => ['Owner', 'Admin'].includes(ur.role.name)) || false;

    if (paymentDate > today && !isOwnerOrAdmin) {
      throw new ValidationError('Future payment dates are only allowed for owners');
    }

    const payment = await prisma.$transaction(async (tx) => {
      // 1. Create the Payment record
      const pmt = await (tx as any).payment.create({
        data: {
          paymentNumber: `PAY-${Date.now()}`,
          companyId,
          date: date ? new Date(date) : new Date(),
          amount: Number(amount),
          method,
          reference,
          description,
          invoiceId,
          billId,
          lcId,
          accountId,
          status: 'APPROVED',
          piAllocations: piAllocations ? {
            create: piAllocations.map((alloc: any) => ({
              piId: alloc.piId,
              allocatedAmount: Number(alloc.allocatedAmount)
            }))
          } : undefined
        }
      });

      // 2. Journal Entry & Status Updates if LC/PI
      if (lcId && piAllocations && piAllocations.length > 0) {
        const lc = await (tx as any).lC.findUnique({
          where: { id: lcId },
          include: { 
            pis: { include: { paymentAllocations: true } }
          }
        });

        if (!lc) throw new NotFoundError('LC not found');

        // Auto-journal for LC Payment
        await TransactionRepository.generatePaymentJournal(tx, pmt, companyId, userId, lc.type === 'EXPORT' ? 'LC_EXPORT' : 'LC_IMPORT');

        // Update PI Statuses
        for (const alloc of piAllocations) {
          const pi = await (tx as any).pI.findUnique({
            where: { id: alloc.piId },
            include: { paymentAllocations: true }
          });

          if (pi) {
            const totalAllocated = (pi.paymentAllocations as any[]).reduce((sum: number, a: any) => sum + a.allocatedAmount, 0) + Number(alloc.allocatedAmount);
            let piStatus = totalAllocated >= pi.amount ? 'PAID' : 'PARTIALLY_PAID';
            await (tx as any).pI.update({ where: { id: pi.id }, data: { status: piStatus } });
          }
        }

        // Update LC Status
        const currentLCPaidTotal = (lc as any).pis.reduce((sum: number, pi: any) => {
             return sum + (pi.paymentAllocations as any[]).reduce((s: number, a: any) => s + a.allocatedAmount, 0);
        }, 0) + piAllocations.reduce((sum: number, a: any) => sum + Number(a.allocatedAmount), 0);
        
        await (tx as any).lC.update({
          where: { id: lc.id },
          data: { status: currentLCPaidTotal >= lc.amount ? 'CLOSED' : 'PARTIALLY_PAID' }
        });
      }

      // 3. Invoice/Bill Payment (Sales or Purchase)
      if (invoiceId) {
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) throw new NotFoundError('Invoice not found');

        // Auto-journal for Regular Invoice Payment
        await TransactionRepository.generatePaymentJournal(tx, pmt, companyId, userId, invoice.type === 'SALES' ? 'SALES' : 'PURCHASE');
        
        // Update Invoice status logic...
        const previousPayments = await tx.payment.aggregate({
          where: { invoiceId: invoice.id },
          _sum: { amount: true }
        });
        
        const totalPaid = (previousPayments._sum.amount || 0) + Number(amount);
        let newStatus = totalPaid >= invoice.total ? 'PAID' : (totalPaid > 0 ? 'PARTIALLY_PAID' : invoice.status);
        
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: newStatus }
        });
      }

      return pmt;
    });

    // Log Activity
    await NotificationController.logActivity({
      companyId,
      entityType: 'payment',
      entityId: payment.id,
      action: 'CREATED',
      performedById: userId,
      metadata: { docNumber: payment.paymentNumber }
    });

    return reply.status(201).send({ success: true, data: payment });
  }

  async listPayments(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const payments = await (prisma as any).payment.findMany({
      where: { companyId },
      include: { 
        invoice: true, 
        bill: true, 
        account: true,
        lc: true,
        piAllocations: {
          include: { pi: true }
        }
      },
      orderBy: { date: 'desc' }
    });
    return reply.send({ success: true, data: payments });
  }

  async createTransfer(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request.user as any).id;

    const { fromAccountId, toAccountId, amount, date, reference, description } = data;

    if (!amount || amount <= 0) {
      throw new ValidationError('Valid transfer amount is required');
    }
    if (!fromAccountId || !toAccountId) {
      throw new ValidationError('Source and destination accounts are required');
    }
    if (fromAccountId === toAccountId) {
      throw new ValidationError('Source and destination accounts must be different');
    }

    const transfer = await prisma.$transaction(async (tx) => {
      // Create a Payment record for the transfer history
      const pmt = await (tx as any).payment.create({
        data: {
          paymentNumber: `TRF-${Date.now()}`,
          companyId,
          date: date ? new Date(date) : new Date(),
          amount: Number(amount),
          method: 'TRANSFER',
          reference,
          description: description || 'Account Transfer',
          accountId: fromAccountId,
          status: 'APPROVED'
        }
      });

      // Auto-journal for Bank Transfer
      await TransactionRepository.generateTransferJournal(tx, pmt, companyId, userId, toAccountId);

      return pmt;
    });

    await NotificationController.logActivity({
      companyId,
      entityType: 'payment',
      entityId: transfer.id,
      action: 'CREATED',
      performedById: userId,
      metadata: { docNumber: transfer.paymentNumber, isTransfer: true }
    });

    return reply.status(201).send({ success: true, data: transfer });
  }

}
