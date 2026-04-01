import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler';
import { NotificationController } from './notification.controller';

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

    // Settings-driven Compliance Checks
    const settings = await prisma.companySettings.findUnique({ where: { companyId } });
    if (settings) {
      if (settings.disallowFutureDates && paymentDate > today) {
        throw new ValidationError('Company settings strictly disallow posting transactions with a future date.');
      }
      if (settings.lockPreviousMonths) {
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        if (paymentDate < firstDayOfMonth && !isOwnerOrAdmin) {
          throw new ValidationError('Company settings restrict posting to previous months based on period lock rules.');
        }
      }
    } else {
      if (paymentDate > today && !isOwnerOrAdmin) {
        throw new ValidationError('Future payment dates are only allowed for owners');
      }
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

        const isExport = lc.type === 'EXPORT';
        const arApCategory = isExport ? 'AR' : 'AP';
        const arApAccount = await tx.account.findFirst({
            where: { companyId, category: arApCategory } as any
        });

        if (!accountId || !arApAccount) {
            throw new ValidationError(`${arApCategory} settlement account not found`);
        }

        // Create Journal Entry for LC Payment
        const journalDesc = isExport 
          ? `LC Export Receipt: ${lc.lcNumber}`
          : `LC Import Payment: ${lc.lcNumber}`;

        await tx.journalEntry.create({
          data: {
            entryNumber: `JV-LC-${pmt.id.substring(0,8)}`,
            companyId,
            date: date ? new Date(date) : new Date(),
            description: journalDesc,
            totalDebit: Number(amount),
            totalCredit: Number(amount),
            status: 'APPROVED',
            createdById: userId,
            approvedById: userId,
            approvedAt: new Date(),
            lines: {
              create: [
                { 
                  accountId: accountId, 
                  debit: isExport ? Number(amount) : 0, 
                  credit: isExport ? 0 : Number(amount), 
                  debitBase: isExport ? Number(amount) : 0, 
                  creditBase: isExport ? 0 : Number(amount) 
                },
                { 
                  accountId: arApAccount.id, 
                  debit: isExport ? 0 : Number(amount), 
                  credit: isExport ? Number(amount) : 0, 
                  debitBase: isExport ? 0 : Number(amount), 
                  creditBase: isExport ? Number(amount) : 0 
                }
              ]
            }
          }
        });

        // Update balances: 
        // Export: Cash/Bank + (Debit), AR - (Credit)
        // Import: Cash/Bank - (Credit), AP + (Debit)
        await tx.account.update({ where: { id: accountId }, data: { currentBalance: { increment: isExport ? Number(amount) : -Number(amount) } } });
        await tx.account.update({ where: { id: arApAccount.id }, data: { currentBalance: { increment: isExport ? -Number(amount) : Number(amount) } } });

        // Update PI Statuses
        for (const alloc of piAllocations) {
          const pi = await (tx as any).pI.findUnique({
            where: { id: alloc.piId },
            include: { paymentAllocations: true }
          });

          if (pi) {
            const totalAllocated = (pi.paymentAllocations as any[]).reduce((sum: number, a: any) => sum + a.allocatedAmount, 0) + Number(alloc.allocatedAmount);

            let piStatus = 'PARTIALLY_PAID';
            if (totalAllocated >= pi.amount) {
              piStatus = 'PAID';
            }
            await (tx as any).pI.update({
              where: { id: pi.id },
              data: { status: piStatus }
            });
          }
        }

        // Update LC Status
        const totalPaid = (lc.pis as any[]).reduce((sum: number, pi: any) => {
          const piPaid = (pi.paymentAllocations as any[]).reduce((s: number, a: any) => s + a.allocatedAmount, 0);
          return sum + piPaid;
        }, 0) + piAllocations.reduce((sum: number, a: any) => sum + Number(a.allocatedAmount), 0);

        let lcStatus = 'PARTIALLY_PAID';
        if (totalPaid >= lc.amount) {
          lcStatus = 'CLOSED';
        }
        await (tx as any).lC.update({
          where: { id: lc.id },
          data: { status: lcStatus }
        });
      }

      // 3. Invoice Payment (Sales AR or Purchase AP)
      if (invoiceId) {
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) throw new NotFoundError('Invoice not found');

        const isSales = invoice.type === 'SALES';
        const arApCategory = isSales ? 'AR' : 'AP';
        const arApAccount = await tx.account.findFirst({
            where: { companyId, category: arApCategory } as any
        });
        
        if (!accountId || !arApAccount) {
            throw new ValidationError(`${arApCategory} settlement account not found`);
        }

        const journalDesc = isSales 
          ? `Payment received for Invoice ${invoice.invoiceNumber}`
          : `Payment made for Purchase Invoice ${invoice.invoiceNumber}`;

        await tx.journalEntry.create({
          data: {
            entryNumber: `JV-PMT-${pmt.id.substring(0,8)}`,
            companyId,
            date: date ? new Date(date) : new Date(),
            description: journalDesc,
            totalDebit: Number(amount),
            totalCredit: Number(amount),
            status: 'APPROVED',
            createdById: userId,
            approvedById: userId,
            approvedAt: new Date(),
            lines: {
              create: [
                { 
                  accountId: accountId, 
                  debit: isSales ? Number(amount) : 0, 
                  credit: isSales ? 0 : Number(amount), 
                  debitBase: isSales ? Number(amount) : 0, 
                  creditBase: isSales ? 0 : Number(amount) 
                },
                { 
                  accountId: arApAccount.id, 
                  debit: isSales ? 0 : Number(amount), 
                  credit: isSales ? Number(amount) : 0, 
                  debitBase: isSales ? 0 : Number(amount), 
                  creditBase: isSales ? Number(amount) : 0 
                }
              ]
            }
          }
        });

        await tx.account.update({ where: { id: accountId }, data: { currentBalance: { increment: isSales ? Number(amount) : -Number(amount) } } });
        await tx.account.update({ where: { id: arApAccount.id }, data: { currentBalance: { increment: isSales ? -Number(amount) : Number(amount) } } });
        
        // Calculate total previously paid
        const previousPayments = await tx.payment.aggregate({
          where: { invoiceId: invoice.id },
          _sum: { amount: true }
        });
        
        const totalPaid = (previousPayments._sum.amount || 0) + Number(amount);
        let newStatus = invoice.status;
        
        if (totalPaid >= invoice.total) {
          newStatus = 'PAID';
        } else if (totalPaid > 0) {
          newStatus = 'PARTIALLY_PAID';
        }
        
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
          method: 'TRANSFER', // Use TRANSFER as the method
          reference,
          description: description || 'Account Transfer',
          accountId: fromAccountId, // Store source here
          status: 'APPROVED'
        }
      });

      // Create the Journal Entry for the transfer
      await tx.journalEntry.create({
        data: {
          entryNumber: `JV-TRF-${pmt.id.substring(0,8)}`,
          companyId,
          date: date ? new Date(date) : new Date(),
          description: description || `Transfer from ${fromAccountId} to ${toAccountId}`,
          reference: reference || pmt.paymentNumber,
          totalDebit: Number(amount),
          totalCredit: Number(amount),
          status: 'APPROVED',
          createdById: userId,
          approvedById: userId,
          approvedAt: new Date(),
          lines: {
            create: [
              { 
                accountId: toAccountId,     // Receiving account is debited (Assets increase)
                debit: Number(amount), 
                credit: 0, 
                debitBase: Number(amount), 
                creditBase: 0 
              },
              { 
                accountId: fromAccountId,   // Giving account is credited (Assets decrease)
                debit: 0, 
                credit: Number(amount), 
                debitBase: 0, 
                creditBase: Number(amount) 
              }
            ]
          }
        }
      });

      // Update balances
      // Assumes both are asset accounts (Cash/Bank), normal balance is Debit.
      // Debit increases balance, Credit decreases balance.
      await tx.account.update({ 
        where: { id: toAccountId }, 
        data: { currentBalance: { increment: Number(amount) } } 
      });
      await tx.account.update({ 
        where: { id: fromAccountId }, 
        data: { currentBalance: { decrement: Number(amount) } } 
      });

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
