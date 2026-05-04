import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';

export class ReportDrilldownController {
  static async getAccountTransactions(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { accountId, fromDate, toDate, type } = request.query as { 
      accountId: string; 
      fromDate?: string;
      toDate?: string;
      type?: string;
    };

    try {
      const where: any = {
        journalEntry: { 
          companyId, 
          status: 'APPROVED',
          deletedAt: null 
        },
        accountId
      };

      if (fromDate || toDate) {
        where.journalEntry.date = {};
        if (fromDate) where.journalEntry.date.gte = new Date(fromDate);
        if (toDate) where.journalEntry.date.lte = new Date(toDate);
      }

      const lines = await prisma.journalEntryLine.findMany({
        where,
        include: {
          journalEntry: { 
            select: { 
              entryNumber: true, 
              date: true, 
              description: true,
              reference: true 
            } 
          },
          account: { select: { name: true, code: true } }
        },
        orderBy: { journalEntry: { date: 'desc' } },
        take: 200
      });

      const transactions = lines.map(line => ({
        id: line.id,
        date: line.journalEntry.date,
        entryNumber: line.journalEntry.entryNumber,
        description: line.journalEntry.description || line.journalEntry.reference || '-',
        debit: line.debitBase,
        credit: line.creditBase,
        runningBalance: 0 // Will be calculated on frontend
      }));

      // Calculate running balance
      let balance = 0;
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        include: { accountType: true }
      });
      const isDebitNormal = account?.accountType?.name === 'ASSET' || account?.accountType?.name === 'EXPENSE';
      
      for (let i = transactions.length - 1; i >= 0; i--) {
        if (isDebitNormal) {
          balance += (transactions[i].debit || 0) - (transactions[i].credit || 0);
        } else {
          balance += (transactions[i].credit || 0) - (transactions[i].debit || 0);
        }
        transactions[i].runningBalance = balance;
      }

      // Get totals
      const totals = {
        totalDebit: lines.reduce((s, l) => s + Number(l.debitBase || 0), 0),
        totalCredit: lines.reduce((s, l) => s + Number(l.creditBase || 0), 0),
        endingBalance: balance
      };

      return reply.send({ 
        success: true, 
        data: { 
          transactions, 
          totals,
          accountName: account?.name,
          accountCode: account?.code
        } 
      });
    } catch (error) {
      console.error('Error fetching drilldown:', error);
      return reply.status(500).send({ error: 'Failed to fetch transactions' });
    }
  }

  static async getTrialBalanceDrilldown(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { fromDate, toDate, type } = request.query as { 
      fromDate?: string;
      toDate?: string;
      type?: string;
    };

    try {
      const dateFilter: any = {};
      if (fromDate) dateFilter.gte = new Date(fromDate);
      if (toDate) dateFilter.lte = new Date(toDate);

      const accounts = await prisma.account.findMany({
        where: { companyId, isActive: true },
        include: { accountType: true }
      });

      const accountIds = accounts.map(a => a.id);

      const where = {
        journalEntry: {
          companyId,
          status: 'APPROVED',
          deletedAt: null,
          date: Object.keys(dateFilter).length > 0 ? dateFilter : undefined
        },
        accountId: { in: accountIds }
      };

      const lines = await prisma.journalEntryLine.findMany({
        where,
        select: {
          accountId: true,
          debitBase: true,
          creditBase: true
        }
      });

      // Aggregate by account
      const accountBalances = new Map();
      
      for (const line of lines) {
        const account = accounts.find(a => a.id === line.accountId);
        if (!account) continue;
        
        const isDebitNormal = account.accountType.name === 'ASSET' || account.accountType.name === 'EXPENSE';
        const net = isDebitNormal 
          ? (Number(line.debitBase || 0) - Number(line.creditBase || 0))
          : (Number(line.creditBase || 0) - Number(line.debitBase || 0));
        
        const current = accountBalances.get(line.accountId) || { debit: 0, credit: 0 };
        
        if (net > 0) {
          current.debit += net;
        } else {
          current.credit += Math.abs(net);
        }
        
        accountBalances.set(line.accountId, current);
      }

      const results = accounts.map(acc => {
        const balances = accountBalances.get(acc.id) || { debit: 0, credit: 0 };
        return {
          accountId: acc.id,
          accountName: acc.name,
          accountCode: acc.code,
          debit: balances.debit,
          credit: balances.credit
        };
      }).filter(r => r.debit > 0 || r.credit > 0);

      return reply.send({ success: true, data: results });
    } catch (error) {
      console.error('Error fetching trial balance:', error);
      return reply.status(500).send({ error: 'Failed to fetch trial balance' });
    }
  }
}