import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { NotFoundError, ValidationError } from '../../middleware/errorHandler';

export class ReconcileController {
  
  async getReconcileLines(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { accountId, startDate, endDate } = request.query as any;

    if (!accountId) {
      throw new ValidationError('Bank Account ID is required');
    }

    const where: any = {
      accountId,
      journalEntry: {
        companyId,
        status: 'APPROVED'
      },
      reconciled: false
    };

    if (startDate || endDate) {
      where.journalEntry.date = {};
      if (startDate) where.journalEntry.date.gte = new Date(startDate);
      if (endDate) where.journalEntry.date.lte = new Date(endDate);
    }

    const lines = await prisma.journalEntryLine.findMany({
      where,
      include: {
        journalEntry: true,
        account: true
      },
      orderBy: { journalEntry: { date: 'asc' } }
    });

    return reply.send({ success: true, data: lines });
  }

  async markAsReconciled(request: FastifyRequest, reply: FastifyReply) {
    const { lineIds } = request.body as { lineIds: string[] };

    if (!lineIds || !lineIds.length) {
      throw new ValidationError('No transactions selected');
    }

    await prisma.journalEntryLine.updateMany({
      where: { id: { in: lineIds } },
      data: {
        reconciled: true,
        reconciledAt: new Date()
      }
    });

    return reply.send({ success: true, message: 'Transactions reconciled successfully' });
  }
}
