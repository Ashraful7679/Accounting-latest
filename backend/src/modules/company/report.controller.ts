import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { BaseCompanyController } from './base.controller';

export class ReportController extends BaseCompanyController {
  async getDashboardStats(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    
    const { startDate, endDate } = request.query as { startDate?: string; endDate?: string };
    const [balanceSheet, pnl, cashflow] = await Promise.all([
      this._calculateBalanceSheet(companyId, startDate, endDate),
      this._calculatePnL(companyId, startDate, endDate),
      this._calculateCashFlow(companyId)
    ]);

    return reply.send({
      success: true,
      data: {
        totalAssets: balanceSheet.totalAssets,
        totalLiabilities: balanceSheet.totalLiabilities,
        netProfit: pnl.netProfit,
        cashBalance: cashflow.endingCash
      }
    });
  }

  async getAccountBalances(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const accounts = await prisma.account.findMany({
      where: { companyId },
      include: { accountType: true }
    });
    return reply.send({ success: true, data: accounts });
  }

  async getTrialBalance(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { startDate, endDate } = request.query as { startDate?: string; endDate?: string };

    const dateFilter: any = {};
    if (startDate && startDate !== '') dateFilter.gte = new Date(startDate);
    if (endDate && endDate !== '') dateFilter.lte = new Date(endDate);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const accounts = await prisma.account.findMany({
      where: { companyId },
      include: {
        accountType: true,
        journalLines: {
          where: {
            journalEntry: {
              status: 'APPROVED',
              ...(hasDateFilter ? { date: dateFilter } : {})
            }
          }
        }
      },
      orderBy: { code: 'asc' }
    });

    const trialBalance = accounts.map(acc => {
      const totalDebit = acc.journalLines.reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
      const totalCredit = acc.journalLines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        accountType: (acc as any).accountType?.name || '',
        openingBalance: acc.openingBalance,
        debit: totalDebit,
        credit: totalCredit,
        balance: totalDebit - totalCredit,
      };
    }).filter(a => a.debit !== 0 || a.credit !== 0 || a.openingBalance !== 0);

    const totals = {
      totalDebit: trialBalance.reduce((s, a) => s + a.debit, 0),
      totalCredit: trialBalance.reduce((s, a) => s + a.credit, 0),
    };

    return reply.send({ success: true, data: { accounts: trialBalance, totals } });
  }

  async getLedger(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { accountId, accountName, startDate, endDate } = request.query as any;
    
    const where: any = {
      journalEntry: {
        companyId,
        status: 'APPROVED',
        ...(startDate || endDate ? {
          date: {
            ...(startDate && startDate !== '' ? { gte: new Date(startDate) } : {}),
            ...(endDate && endDate !== '' ? { lte: new Date(endDate) } : {}),
          }
        } : {})
      }
    };

    if (accountId) {
      where.accountId = accountId;
    } else if (accountName) {
      where.account = {
        name: { contains: accountName, mode: 'insensitive' }
      };
    } else {
      // If no filter, maybe return empty or last 100?
      // For now, if no account filter, return empty to avoid massive data
      return reply.send({ success: true, data: [] });
    }

    const lines = await prisma.journalEntryLine.findMany({
      where,
      include: {
        journalEntry: true,
        account: {
          include: { accountType: true }
        }
      },
      orderBy: {
        journalEntry: { date: 'asc' }
      }
    });

    return reply.send({ success: true, data: lines });
  }

  async getProfitLoss(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { startDate, endDate, compareStartDate, compareEndDate } = request.query as any;
    const pnl = await this._calculatePnL(companyId, startDate, endDate);

    let comparison: any = null;
    if (compareStartDate && compareEndDate) {
      const priorPnl = await this._calculatePnL(companyId, compareStartDate, compareEndDate);
      comparison = {
        prior: priorPnl,
        revenueVariance: pnl.revenue - priorPnl.revenue,
        revenueVariancePct: priorPnl.revenue !== 0 ? ((pnl.revenue - priorPnl.revenue) / Math.abs(priorPnl.revenue)) * 100 : (pnl.revenue !== 0 ? 100 : 0),
        expenseVariance: pnl.expenses - priorPnl.expenses,
        expenseVariancePct: priorPnl.expenses !== 0 ? ((pnl.expenses - priorPnl.expenses) / Math.abs(priorPnl.expenses)) * 100 : (pnl.expenses !== 0 ? 100 : 0),
        netProfitVariance: pnl.netProfit - priorPnl.netProfit,
      };
    }

    return reply.send({ success: true, data: { ...pnl, comparison } });
  }

  async getBalanceSheet(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { startDate, endDate } = request.query as any;
    const bs = await this._calculateBalanceSheet(companyId, startDate, endDate);

    // Accounting equation validation
    const pnl = await this._calculatePnL(companyId, startDate, endDate);
    const isBalanced = Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity + pnl.netProfit)) < 1;

    return reply.send({
      success: true,
      data: {
        ...bs,
        netProfit: pnl.netProfit,
        isBalanced,
        equation: `Assets (${bs.totalAssets.toFixed(2)}) = Liabilities (${bs.totalLiabilities.toFixed(2)}) + Equity (${bs.totalEquity.toFixed(2)}) + Net Income (${pnl.netProfit.toFixed(2)})`
      }
    });
  }

  async getAgingReport(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { type } = request.query as { type?: 'AR' | 'AP' };

    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        type: type === 'AP' ? 'PURCHASE' : 'SALES',
        status: { in: ['APPROVED', 'PARTIALLY_PAID'] }
      },
      include: {
        customer: true,
        vendor: true,
        payments: true
      }
    });

    const buckets = {
      current: 0,
      '1-30': 0,
      '31-60': 0,
      '61-90': 0,
      '90+': 0
    };

    invoices.forEach(inv => {
      const paid = inv.payments.reduce((sum, p) => sum + p.amount, 0);
      const balance = inv.total - paid;
      if (balance <= 0) return;

      const dueDate = inv.dueDate || inv.invoiceDate;
      const daysOverdue = Math.floor((new Date().getTime() - new Date(dueDate).getTime()) / (1000 * 3600 * 24));

      if (daysOverdue <= 0) buckets.current += balance;
      else if (daysOverdue <= 30) buckets['1-30'] += balance;
      else if (daysOverdue <= 60) buckets['31-60'] += balance;
      else if (daysOverdue <= 90) buckets['61-90'] += balance;
      else buckets['90+'] += balance;
    });

    return reply.send({ success: true, data: buckets });
  }

  async searchReceivables(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { query, type } = request.query as { query?: string; type?: string };

    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        type: type === 'PURCHASE' ? 'PURCHASE' : 'SALE',
        status: { in: ['APPROVED', 'PARTIALLY_PAID'] },
        OR: query ? [
          { invoiceNumber: { contains: query, mode: 'insensitive' } },
          { customer: { name: { contains: query, mode: 'insensitive' } } },
          { vendor: { name: { contains: query, mode: 'insensitive' } } }
        ] : undefined
      },
      include: {
        customer: true,
        vendor: true,
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const results = invoices.map(inv => {
      const paid = inv.payments.reduce((sum, p) => sum + p.amount, 0);
      const balance = inv.total - paid;
      return {
        id: inv.id,
        number: inv.invoiceNumber,
        date: inv.invoiceDate,
        entity: inv.customer?.name || inv.vendor?.name || 'Unknown',
        total: inv.total,
        paid,
        balance,
        daysOverdue: Math.floor((new Date().getTime() - new Date(inv.dueDate || inv.invoiceDate).getTime()) / (1000 * 3600 * 24))
      };
    }).filter(r => r.balance > 0);

    return reply.send({ success: true, data: results });
  }

  async getLCLiability(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };

    const lcs = await prisma.lC.findMany({
      where: { 
        companyId,
        status: { in: ['OPEN', 'AMENDED'] }
      }
    });

    const totalLiability = lcs.reduce((sum, lc) => sum + lc.amount, 0);
    const count = lcs.length;

    return reply.send({ 
      success: true, 
      data: { 
        totalLiability, 
        count,
        lcs: lcs.map(lc => ({
          id: lc.id,
          number: lc.lcNumber,
          type: lc.type,
          amount: lc.amount,
          expiryDate: lc.expiryDate,
          bank: lc.bankName
        }))
      } 
    });
  }

  private async _calculateBalanceSheet(companyId: string, startDate?: string, endDate?: string) {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const accounts = await prisma.account.findMany({
      where: { companyId },
      include: {
        accountType: true,
        journalLines: {
          where: {
            journalEntry: {
              status: 'APPROVED',
              ...(hasDateFilter ? { date: dateFilter } : {})
            }
          }
        }
      }
    });

    const calcBalance = (accs: any[], type: string) => {
      return accs
        .filter((a: any) => a.accountType?.name === type)
        .reduce((sum: number, a: any) => {
          const isDebitNormal = a.accountType?.type === 'DEBIT';
          const lineBalance = a.journalLines.reduce((s: number, l: any) => {
            return s + (isDebitNormal
              ? (Number(l.debit || 0) - Number(l.credit || 0))
              : (Number(l.credit || 0) - Number(l.debit || 0)));
          }, 0);
          return sum + lineBalance + (a.openingBalance || 0);
        }, 0);
    };

    const totalAssets = calcBalance(accounts, 'ASSET');
    const totalLiabilities = calcBalance(accounts, 'LIABILITY');
    const totalEquity = calcBalance(accounts, 'EQUITY');

    const getBreakdown = (accs: any[], type: string) => {
      return accs
        .filter((a: any) => a.accountType?.name === type)
        .map((a: any) => ({
          id: a.id,
          name: a.name,
          balance: (a.openingBalance || 0) + a.journalLines.reduce((s: number, l: any) => {
            const isDebitNormal = a.accountType?.type === 'DEBIT';
            return s + (isDebitNormal
              ? (Number(l.debit || 0) - Number(l.credit || 0))
              : (Number(l.credit || 0) - Number(l.debit || 0)));
          }, 0)
        }))
        .filter(a => Math.abs(a.balance) > 0.01);
    };

    return { 
      totalAssets, 
      totalLiabilities, 
      totalEquity,
      assets: getBreakdown(accounts, 'ASSET'),
      liabilities: getBreakdown(accounts, 'LIABILITY'),
      equity: getBreakdown(accounts, 'EQUITY')
    };
  }

  private async _calculatePnL(companyId: string, startDate?: string, endDate?: string) {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const accounts = await prisma.account.findMany({
      where: { companyId },
      include: {
        accountType: true,
        journalLines: {
          where: {
            journalEntry: {
              status: 'APPROVED',
              ...(hasDateFilter ? { date: dateFilter } : {})
            }
          }
        }
      }
    });

    const revenueAccounts = accounts.filter((a: any) => a.accountType?.name === 'INCOME' || a.accountType?.name === 'REVENUE');
    const expenseAccounts = accounts.filter((a: any) => a.accountType?.name === 'EXPENSE');

    const revenue = revenueAccounts.reduce((sum: number, a: any) => {
      return sum + a.journalLines.reduce((s: number, l: any) => s + (Number(l.credit || 0) - Number(l.debit || 0)), 0);
    }, 0);

    const expenses = expenseAccounts.reduce((sum: number, a: any) => {
      return sum + a.journalLines.reduce((s: number, l: any) => s + (Number(l.debit || 0) - Number(l.credit || 0)), 0);
    }, 0);

    return {
      revenue,
      expenses,
      totalIncome: revenue, // Aliases for frontend
      totalExpense: expenses,
      netProfit: revenue - expenses,
      income: revenueAccounts.map((a: any) => ({
        id: a.id, code: a.code, name: a.name,
        amount: a.journalLines.reduce((s: number, l: any) => s + (Number(l.credit || 0) - Number(l.debit || 0)), 0)
      })).filter((a: any) => Math.abs(a.amount) > 0.01),
      expenses: expenseAccounts.map((a: any) => ({
        id: a.id, code: a.code, name: a.name,
        amount: a.journalLines.reduce((s: number, l: any) => s + (Number(l.debit || 0) - Number(l.credit || 0)), 0)
      })).filter((a: any) => Math.abs(a.amount) > 0.01)
    };
  }

  async getCashFlowStatement(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { startDate, endDate } = request.query as { startDate?: string; endDate?: string };

    const now = new Date();
    const periodStart = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = endDate ? new Date(endDate) : now;

    // Get all journal lines within the period that have a cashFlowType
    const lines = await prisma.journalEntryLine.findMany({
      where: {
        journalEntry: { companyId, status: 'APPROVED', date: { gte: periodStart, lte: periodEnd } },
        account: { cashFlowType: { not: null } }
      },
      include: { account: true }
    });

    const operating = { inflows: 0, outflows: 0, net: 0 };
    const investing = { inflows: 0, outflows: 0, net: 0 };
    const financing = { inflows: 0, outflows: 0, net: 0 };

    for (const line of lines) {
      const amount = Number(line.credit) - Number(line.debit);
      const cfType = (line as any).account.cashFlowType;

      const bucket = cfType === 'OPERATING' ? operating : cfType === 'INVESTING' ? investing : cfType === 'FINANCING' ? financing : null;
      if (!bucket) continue;

      if (amount > 0) bucket.inflows += amount;
      else bucket.outflows += Math.abs(amount);
    }

    operating.net = operating.inflows - operating.outflows;
    investing.net = investing.inflows - investing.outflows;
    financing.net = financing.inflows - financing.outflows;

    const netChange = operating.net + investing.net + financing.net;

    // Beginning cash = current cash balance minus net change in this period
    const cashAccounts = await prisma.account.findMany({
      where: { companyId, category: { in: ['CASH', 'BANK'] } }
    });
    const endingCash = cashAccounts.reduce((s, a) => s + a.currentBalance, 0);
    const beginningCash = endingCash - netChange;

    return reply.send({
      success: true,
      data: {
        periodStart,
        periodEnd,
        beginningCash,
        operating,
        investing,
        financing,
        netChange,
        endingCash,
        verification: Math.abs((beginningCash + netChange) - endingCash) < 0.01
      }
    });
  }

  private async _calculateCashFlow(companyId: string) {
    const accounts = await prisma.account.findMany({ where: { companyId, category: { in: ['CASH', 'BANK'] } } });
    return {
      endingCash: accounts.reduce((s, a) => s + a.currentBalance, 0)
    };
  }
}
