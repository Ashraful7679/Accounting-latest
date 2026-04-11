import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { ValidationError } from '../../middleware/errorHandler';
import { BaseCompanyController } from './base.controller';

export class PeriodController extends BaseCompanyController {
  
  async closePeriod(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { closingDate, description } = request.body as { closingDate: string; description?: string };
    const userId = (request.user as any).id;

    const result = await prisma.$transaction(async (tx: any) => {
      const entryNumber = await this.generateDocumentNumber(companyId, 'journal', tx);

      // 1. Find all Income and Expense accounts
      const plAccounts = await tx.account.findMany({
        where: { 
          companyId, 
          accountType: { name: { in: ['INCOME', 'EXPENSE'] } },
          isActive: true
        },
        include: { accountType: true }
      });

      // 2. Find Retained Earnings Account
      let reAccount = await tx.account.findFirst({
        where: { companyId, name: 'Retained Earnings', accountType: { name: 'EQUITY' } }
      });

      if (!reAccount) {
        throw new ValidationError('Retained Earnings account not configured for this company');
      }

      const journalLines: any[] = [];
      let totalDebit = 0;
      let totalCredit = 0;

      for (const acc of plAccounts) {
        const isDebitType = acc.accountType.type === 'DEBIT';
        const currentBal = Number(acc.currentBalance);
        
        let debit = 0;
        let credit = 0;

        if (isDebitType) {
          if (currentBal > 0) credit = currentBal;
          else if (currentBal < 0) debit = Math.abs(currentBal);
        } else {
          if (currentBal > 0) debit = currentBal;
          else if (currentBal < 0) credit = Math.abs(currentBal);
        }

        if (debit > 0 || credit > 0) {
          totalDebit += debit;
          totalCredit += credit;
          journalLines.push({
            accountId: acc.id,
            description: `Closing Entry - ${acc.name}`,
            debit,
            credit,
            debitBase: debit,
            creditBase: credit
          });

          await tx.account.update({
             where: { id: acc.id },
             data: { currentBalance: 0 }
          });
        }
      }

      const diff = totalDebit - totalCredit;
      let reDebit = 0;
      let reCredit = 0;
      let reBalanceChange = 0;

      if (diff > 0) {
        reCredit = diff;
        totalCredit += diff;
        reBalanceChange = diff; 
      } else if (diff < 0) {
        reDebit = Math.abs(diff);
        totalDebit += Math.abs(diff);
        reBalanceChange = -Math.abs(diff);
      }

      if (reDebit > 0 || reCredit > 0) {
         journalLines.push({
            accountId: reAccount.id,
            description: `Period Closing to Retained Earnings`,
            debit: reDebit,
            credit: reCredit,
            debitBase: reDebit,
            creditBase: reCredit
         });

         await tx.account.update({
            where: { id: reAccount.id },
            data: { currentBalance: { increment: reBalanceChange } }
         });
      }

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
         throw new ValidationError('Period closing journal unbalanced');
      }

      const closedJournal = await tx.journalEntry.create({
        data: {
          entryNumber,
          companyId,
          date: new Date(closingDate),
          description: description || `Period Closing Entry for Fiscal Year`,
          totalDebit,
          totalCredit,
          status: 'APPROVED',
          createdById: userId,
          approvedById: userId,
          approvedAt: new Date(),
          lines: {
            create: journalLines
          }
        }
      });

      return closedJournal;
    });

    return reply.send({ success: true, data: result, message: 'Period Closed successfully' });
  }
}
