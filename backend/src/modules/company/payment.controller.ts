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

    const { invoiceId, billId, lcId, piAllocations, accountId, date, amount, method, reference, description } = data;

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
        for (const alloc of piAllocations) {
          // Update PI Status
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
        const lc = await (tx as any).lC.findUnique({
          where: { id: lcId },
          include: { 
            pis: { include: { paymentAllocations: true } }
          }
        });


        if (lc) {
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
      }

      // 3. Existing Invoice Logic
      if (invoiceId) {
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) throw new NotFoundError('Invoice not found');

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
            date: date ? new Date(date) : new Date(),
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

}
