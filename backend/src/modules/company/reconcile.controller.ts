import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { NotFoundError, ValidationError } from '../../middleware/errorHandler';

export class ReconcileController {

  async getReconcileLines(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { accountId, startDate, endDate, showAll } = request.query as any;

    if (!accountId) {
      throw new ValidationError('Bank Account ID is required');
    }

    const where: any = {
      accountId,
      journalEntry: {
        companyId,
        status: 'APPROVED'
      },
    };

    // By default show unreconciled; showAll=true shows everything
    if (!showAll || showAll === 'false') {
      where.reconciled = false;
    }

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

    // Calculate balance summaries
    const allLines = await prisma.journalEntryLine.findMany({
      where: {
        accountId,
        journalEntry: { companyId, status: 'APPROVED' }
      }
    });

    const bookBalance = allLines.reduce((s: number, l: any) => s + (Number(l.debit || 0) - Number(l.credit || 0)), 0);
    const reconciledBalance = allLines
      .filter((l: any) => l.reconciled)
      .reduce((s: number, l: any) => s + (Number(l.debit || 0) - Number(l.credit || 0)), 0);
    const unreconciledBalance = bookBalance - reconciledBalance;

    // Get the account's opening balance
    const account = await prisma.account.findUnique({ where: { id: accountId } });

    return reply.send({
      success: true,
      data: {
        lines,
        summary: {
          bookBalance: bookBalance + (account?.openingBalance || 0),
          reconciledBalance: reconciledBalance + (account?.openingBalance || 0),
          unreconciledBalance,
          unreconciledCount: allLines.filter((l: any) => !l.reconciled).length,
          totalCount: allLines.length
        }
      }
    });
  }

  async markAsReconciled(request: FastifyRequest, reply: FastifyReply) {
    const { lineIds } = request.body as { lineIds: string[] };

    if (!lineIds || !lineIds.length) {
      throw new ValidationError('No transactions selected');
    }

    const result = await prisma.journalEntryLine.updateMany({
      where: { id: { in: lineIds } },
      data: {
        reconciled: true,
        reconciledAt: new Date()
      }
    });

    console.log(`[Reconcile] Marked ${result.count} lines as reconciled.`);

    return reply.send({ success: true, message: `${result.count} transactions reconciled successfully` });
  }

  async unmarkReconciled(request: FastifyRequest, reply: FastifyReply) {
    const { lineIds } = request.body as { lineIds: string[] };

    if (!lineIds || !lineIds.length) {
      throw new ValidationError('No transactions selected');
    }

    const result = await prisma.journalEntryLine.updateMany({
      where: { id: { in: lineIds } },
      data: {
        reconciled: false,
        reconciledAt: null
      }
    });

    return reply.send({ success: true, message: `${result.count} transactions un-reconciled` });
  }

  async createReconcileEntry(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;
    const { accountId, amount, description, date, type } = request.body as any;
    // type: 'CHARGE' (bank charges, debit from bank) or 'CREDIT' (interest earned, credit to bank)

    if (!accountId || !amount) {
      throw new ValidationError('Account ID and amount are required');
    }

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundError('Account not found');

    // Find or create a Bank Charges expense account
    let expenseAccount = await prisma.account.findFirst({
      where: { companyId, name: { contains: 'Bank Charge', mode: 'insensitive' }, isActive: true }
    });

    if (!expenseAccount) {
      // Find an interest income account for credits
      expenseAccount = await prisma.account.findFirst({
        where: { companyId, name: { contains: 'Interest', mode: 'insensitive' }, isActive: true }
      });
    }

    const counterAccountId = expenseAccount?.id || accountId;
    const parsedAmount = parseFloat(amount);
    const isCharge = type === 'CHARGE';

    // Generate entry number
    const lastEntry = await prisma.journalEntry.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' }
    });
    const seq = lastEntry ? parseInt(lastEntry.entryNumber.split('-').pop() || '0') + 1 : 1;
    const entryNumber = `REC-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;

    const journal = await prisma.journalEntry.create({
      data: {
        entryNumber,
        date: date ? new Date(date) : new Date(),
        companyId,
        createdById: userId,
        status: 'APPROVED',
        description: description || (isCharge ? 'Bank charge (reconciliation)' : 'Bank interest (reconciliation)'),
        totalDebit: parsedAmount,
        totalCredit: parsedAmount,
        lines: {
          create: isCharge ? [
            // Bank charge: Dr Expense, Cr Bank
            { accountId: counterAccountId, debit: parsedAmount, credit: 0, debitBase: parsedAmount, creditBase: 0, exchangeRate: 1, description: 'Bank charges', reconciled: true, reconciledAt: new Date() },
            { accountId, debit: 0, credit: parsedAmount, debitBase: 0, creditBase: parsedAmount, exchangeRate: 1, description: 'Bank charges', reconciled: true, reconciledAt: new Date() },
          ] : [
            // Bank interest: Dr Bank, Cr Income
            { accountId, debit: parsedAmount, credit: 0, debitBase: parsedAmount, creditBase: 0, exchangeRate: 1, description: 'Bank interest received', reconciled: true, reconciledAt: new Date() },
            { accountId: counterAccountId, debit: 0, credit: parsedAmount, debitBase: 0, creditBase: parsedAmount, exchangeRate: 1, description: 'Bank interest received', reconciled: true, reconciledAt: new Date() },
          ]
        }
      },
      include: { lines: true }
    });

    return reply.send({ success: true, data: journal });
  }
}
