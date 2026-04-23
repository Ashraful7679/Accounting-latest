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
          method: method || data.paymentMethod || 'BANK',
          reference,
          description,
          invoiceId,
          billId,
          customerId: data.customerId || undefined,
          vendorId: data.vendorId || undefined,
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
        
        const lcNewStatus = currentLCPaidTotal >= lc.amount ? 'CLOSED' : 'PARTIALLY_PAID';
        await (tx as any).lC.update({
          where: { id: lc.id },
          data: { status: lcNewStatus }
        });

        // LC Margin Release on Closure: Dr Bank, Cr LC Margin Deposit
        if (lcNewStatus === 'CLOSED' && lc.marginPercentage > 0) {
          const marginAmount = Math.round(lc.amount * (lc.conversionRate || 1) * (lc.marginPercentage / 100) * 100) / 100;
          const marginAccount = await tx.account.findFirst({
            where: { companyId, name: { contains: 'LC Margin', mode: 'insensitive' }, isActive: true }
          });
          const bankAcc = await tx.account.findFirst({
            where: { companyId, name: { contains: lc.bankName, mode: 'insensitive' }, category: 'BANK', isActive: true }
          });

          if (marginAccount && bankAcc) {
            const lastEntry = await tx.journalEntry.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' } });
            const seq = lastEntry ? parseInt(lastEntry.entryNumber.split('-').pop() || '0') + 1 : 1;
            const entryNumber = `MR-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;

            await tx.journalEntry.create({
              data: {
                entryNumber,
                date: new Date(),
                companyId,
                createdById: userId,
                status: 'APPROVED',
                description: `LC Margin Release - ${lc.lcNumber}`,
                reference: lc.lcNumber,
                totalDebit: marginAmount,
                totalCredit: marginAmount,
                lines: {
                  create: [
                    { accountId: bankAcc.id, debit: marginAmount, credit: 0, debitBase: marginAmount, creditBase: 0, exchangeRate: 1, description: `Margin release - ${lc.lcNumber}` },
                    { accountId: marginAccount.id, debit: 0, credit: marginAmount, debitBase: 0, creditBase: marginAmount, exchangeRate: 1, description: `Margin release - ${lc.lcNumber}` },
                  ]
                }
              }
            });
          }
        }
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

      if (billId) {
        const bill = await tx.bill.findUnique({ where: { id: billId } });
        if (!bill) throw new NotFoundError('Bill not found');

        // Auto-journal for Regular Bill Payment
        await TransactionRepository.generatePaymentJournal(tx, pmt, companyId, userId, 'PURCHASE');
        
        const previousPayments = await tx.payment.aggregate({
          where: { billId: bill.id },
          _sum: { amount: true }
        });
        
        const totalPaid = (previousPayments._sum.amount || 0) + Number(amount);
        let newStatus = totalPaid >= bill.total ? 'PAID' : (totalPaid > 0 ? 'PARTIALLY_PAID' : bill.status);
        
        await tx.bill.update({
          where: { id: bill.id },
          data: { status: newStatus }
        });
      }

      // 4. Advance Payment Journal Entry (No Invoice/Bill yet)
      if (!invoiceId && !billId && !lcId && (data.customerId || data.vendorId)) {
        await TransactionRepository.generatePaymentJournal(tx, pmt, companyId, userId, data.customerId ? 'SALES' : 'PURCHASE');
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
    const { method, status, unallocated } = request.query as { method?: string; status?: string; unallocated?: string };
    
    const where: any = { companyId };
    if (method) where.method = method;
    if (status) where.status = status;

    let payments = await (prisma as any).payment.findMany({
      where,
      include: { 
        invoice: true, 
        bill: true, 
        account: true,
        lc: true,
        customer: { select: { name: true } },
        vendor: { select: { name: true } },
        piAllocations: {
          include: { pi: true }
        },
        invoiceAllocations: {
          include: { invoice: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    if (unallocated === 'true') {
      payments = payments.filter((p: any) => {
        const allocatedAmount = (p.invoiceAllocations || []).reduce((sum: number, a: any) => sum + a.amount, 0) + 
                                (p.piAllocations || []).reduce((sum: number, a: any) => sum + a.allocatedAmount, 0);
        (p as any).unallocatedAmount = p.amount - allocatedAmount;
        return (p as any).unallocatedAmount > 0;
      });
    }

    return reply.send({ success: true, data: payments });
  }

  async allocatePayment(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { paymentId, allocations } = request.body as { paymentId: string; allocations: any[] };
    const userId = (request.user as any).id;

    if (!paymentId || !allocations || !Array.isArray(allocations)) {
      throw new ValidationError('Payment ID and allocations array are required');
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await (tx as any).payment.findUnique({
        where: { id: paymentId },
        include: { invoiceAllocations: true }
      });

      if (!payment) throw new NotFoundError('Payment not found');

      for (const alloc of allocations) {
        // Create allocation record
        await (tx as any).paymentInvoice.create({
          data: {
            paymentId,
            invoiceId: alloc.invoiceId,
            amount: Number(alloc.amount)
          }
        });

        // Update invoice status
        const invoice = await tx.invoice.findUnique({
          where: { id: alloc.invoiceId },
          include: { paymentAllocations: true, invoicePayments: true }
        });

        if (invoice) {
          const totalPaid = (invoice as any).invoicePayments.reduce((sum: number, p: any) => sum + p.amount, 0) +
                           (invoice as any).paymentAllocations.reduce((sum: number, a: any) => sum + a.amount, 0) +
                           Number(alloc.amount);
          
          let newStatus = totalPaid >= invoice.total ? 'PAID' : 'PARTIALLY_PAID';
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { status: newStatus }
          });
        }
      }

      return payment;
    });

    return reply.send({ success: true, data: result });
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

    // Create transfer with PENDING_VERIFICATION status
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
          status: 'PENDING_VERIFICATION' // Set to pending initially
        }
      });

      return pmt;
    });

    await NotificationController.logActivity({
      companyId,
      entityType: 'payment',
      entityId: transfer.id,
      action: 'CREATED',
      performedById: userId,
      metadata: { docNumber: transfer.paymentNumber, isTransfer: true, status: 'PENDING_VERIFICATION' }
    });

    return reply.status(201).send({ success: true, data: transfer });
  }

  async verifyTransfer(request: FastifyRequest, reply: FastifyReply) {
    const { paymentId } = request.params as { paymentId: string };
    const userId = (request.user as any).id;

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.method !== 'TRANSFER') {
      throw new NotFoundError('Transfer not found');
    }

    if (payment.status !== 'PENDING_VERIFICATION') {
      throw new ValidationError('Transfer is not pending verification');
    }

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'APPROVED' }
    });

    await NotificationController.logActivity({
      companyId: payment.companyId,
      entityType: 'payment',
      entityId: payment.id,
      action: 'VERIFIED',
      performedById: userId,
      metadata: { docNumber: payment.paymentNumber }
    });

    return reply.send({ success: true, data: updated });
  }

  async approveTransfer(request: FastifyRequest, reply: FastifyReply) {
    const { paymentId } = request.params as { paymentId: string };
    const userId = (request.user as any).id;
    const { toAccountId } = request.body as { toAccountId: string };

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.method !== 'TRANSFER') {
      throw new NotFoundError('Transfer not found');
    }

    if (payment.status !== 'APPROVED') {
      throw new ValidationError('Transfer must be verified before approval');
    }

    // Generate the journal entry
    await TransactionRepository.generateTransferJournal(prisma, payment, payment.companyId, userId, toAccountId);

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'COMPLETED' }
    });

    await NotificationController.logActivity({
      companyId: payment.companyId,
      entityType: 'payment',
      entityId: payment.id,
      action: 'APPROVED',
      performedById: userId,
      metadata: { docNumber: payment.paymentNumber }
    });

    return reply.send({ success: true, data: updated });
  }

}
