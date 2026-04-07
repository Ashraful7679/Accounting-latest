import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { ReportRepository } from '../../repositories/ReportRepository';

export class ReportController {
  
  // Generic filter builder for Ledger Lines
  private buildLineFilters(query: any) {
    const { 
      startDate, endDate, branchId, projectId, 
      costCenterId, customerId, vendorId 
    } = query;

    const where: any = {
      journalEntry: { status: 'APPROVED' }
    };

    if (startDate || endDate) {
      where.journalEntry.date = {};
      if (startDate) where.journalEntry.date.gte = new Date(startDate);
      if (endDate) where.journalEntry.date.lte = new Date(endDate);
    }

    if (branchId) where.branchId = branchId;
    if (projectId) where.projectId = projectId;
    if (costCenterId) where.costCenterId = costCenterId;
    if (customerId) where.customerId = customerId;
    if (vendorId) where.vendorId = vendorId;

    return where;
  }

  async getTrialBalance(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const filters = this.buildLineFilters(request.query);
    const data = await ReportRepository.getTrialBalance(companyId, filters);
    return reply.send({ success: true, data });
  }

  async getProfitLoss(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const filters = this.buildLineFilters(request.query);

    const accounts = await prisma.account.findMany({
      where: { 
        companyId, 
        accountType: { name: { in: ['INCOME', 'EXPENSE'] } },
        isActive: true 
      },
      include: { 
        accountType: true,
        journalLines: { where: filters }
      }
    });

    const income = [];
    const expenses = [];
    let totalIncome = 0;
    let totalExpense = 0;

    for (const acc of accounts) {
      const debitTotal = acc.journalLines.reduce((sum, l) => sum + l.debitBase, 0);
      const creditTotal = acc.journalLines.reduce((sum, l) => sum + l.creditBase, 0);
      const balance = Math.abs(creditTotal - debitTotal);

      if (acc.accountType.name === 'INCOME') {
        income.push({ name: acc.name, amount: balance });
        totalIncome += balance;
      } else {
        expenses.push({ name: acc.name, amount: balance });
        totalExpense += balance;
      }
    }

    return reply.send({
      success: true,
      data: {
        income,
        expenses,
        totalIncome,
        totalExpense,
        netProfit: totalIncome - totalExpense
      }
    });
  }

  async getBalanceSheet(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const filters = this.buildLineFilters(request.query);
    // Balance sheet is cumulative — deep-copy and strip the startDate lower bound
    const bsFilters = JSON.parse(JSON.stringify(filters));
    if (bsFilters.journalEntry?.date?.gte) {
      delete bsFilters.journalEntry.date.gte;
      if (Object.keys(bsFilters.journalEntry.date).length === 0) {
        delete bsFilters.journalEntry.date;
      }
    }

    const accounts = await prisma.account.findMany({
      where: { 
        companyId, 
        accountType: { name: { in: ['ASSET', 'LIABILITY', 'EQUITY'] } },
        isActive: true 
      },
      include: { 
        accountType: true,
        journalLines: { where: bsFilters }
      }
    });

    // Also get Net Profit for Retained Earnings
    const plAccounts = await prisma.account.findMany({
      where: { 
        companyId, 
        accountType: { name: { in: ['INCOME', 'EXPENSE'] } },
        isActive: true 
      },
      include: { 
        accountType: true,
        journalLines: { where: bsFilters }
      }
    });

    let totalIncome = 0;
    let totalExpense = 0;
    for (const acc of plAccounts) {
      const debitTotal = acc.journalLines.reduce((sum, l) => sum + l.debitBase, 0);
      const creditTotal = acc.journalLines.reduce((sum, l) => sum + l.creditBase, 0);
      if (acc.accountType.name === 'INCOME') totalIncome += (creditTotal - debitTotal);
      else totalExpense += (debitTotal - creditTotal);
    }
    const retainedEarnings = totalIncome - totalExpense;

    const assets = [];
    const liabilities = [];
    const equity = [];

    for (const acc of accounts) {
      const debitTotal = acc.journalLines.reduce((sum, l) => sum + l.debitBase, 0);
      const creditTotal = acc.journalLines.reduce((sum, l) => sum + l.creditBase, 0);
      
      let balance = 0;
      if (acc.accountType.type === 'DEBIT') {
        balance = (acc.openingBalance || 0) + debitTotal - creditTotal;
      } else {
        balance = (acc.openingBalance || 0) + creditTotal - debitTotal;
      }

      const item = { name: acc.name, balance: balance }; // Keep negative balances for contras
      if (acc.accountType.name === 'ASSET') assets.push(item);
      else if (acc.accountType.name === 'LIABILITY') liabilities.push(item);
      else equity.push(item);
    }

    equity.push({ name: 'Retained Earnings (Net Profit)', balance: retainedEarnings });

    return reply.send({
      success: true,
      data: { assets, liabilities, equity }
    });
  }

  async getAgingReport(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { type } = request.query as { type: 'CUSTOMER' | 'VENDOR' };
    const today = new Date();
    const isCust = type === 'CUSTOMER';

    // Fetch approved invoices with their payments and due dates for proper bucketing
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        status: { in: ['APPROVED', 'PARTIALLY_PAID'] },
        type: isCust ? 'SALES' : 'PURCHASE',
      },
      include: {
        customer: isCust ? true : false,
        vendor: !isCust ? true : false,
        payments: { select: { amount: true, status: true } },
      },
    });

    const entityMap = new Map<string, {
      id: string; name: string; balance: number;
      dueCurrent: number; due30: number; due60: number; due90Plus: number;
    }>();

    for (const invoice of invoices) {
      const entity = isCust ? (invoice as any).customer : (invoice as any).vendor;
      if (!entity) continue;

      const totalPaid = ((invoice as any).payments as any[])
        .filter((p: any) => p.status !== 'CANCELLED')
        .reduce((s: number, p: any) => s + Number(p.amount), 0);
      const outstanding = Number(invoice.total) - totalPaid;
      if (outstanding <= 0.01) continue;

      if (!entityMap.has(entity.id)) {
        entityMap.set(entity.id, { id: entity.id, name: entity.name, balance: 0, dueCurrent: 0, due30: 0, due60: 0, due90Plus: 0 });
      }
      const row = entityMap.get(entity.id)!;
      row.balance += outstanding;

      if (!(invoice as any).dueDate) {
        row.dueCurrent += outstanding;
      } else {
        const daysOverdue = Math.floor(
          (today.getTime() - new Date((invoice as any).dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysOverdue <= 0) row.dueCurrent += outstanding;
        else if (daysOverdue <= 30) row.due30 += outstanding;
        else if (daysOverdue <= 60) row.due60 += outstanding;
        else row.due90Plus += outstanding;
      }
    }

    return reply.send({ success: true, data: Array.from(entityMap.values()) });
  }

  async searchReceivables(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;
    const { 
      customerName, reference, minAmount, maxAmount, 
      startDate, endDate, branchId, status 
    } = request.query as any;

    // 1. Permission Check
    const isAdmin = (request.user as any).isAdmin;
    let userCompany = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
      include: { user: { include: { userRoles: { include: { role: true } } } } }
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } }
    });
    const isGlobalOwner = user?.userRoles.some((ur: any) => ur.role.name === 'Owner');

    if (!userCompany && !isAdmin && !isGlobalOwner) {
      return reply.status(403).send({ success: false, message: 'Access denied: You are not a member of this company' });
    }

    let role = 'User';
    if (userCompany) {
      role = userCompany.user.userRoles[0]?.role.name || 'User';
    } else {
      role = isGlobalOwner ? 'Owner' : 'Admin';
    }
    
    // 2. Build Permission Filters (Branch lock, etc.)
    // If user is 'User' role, they might be locked to a specific branch (this logic could be expanded)
    
    // 3. Build Query Filters
    const where: any = {
      journalEntry: { 
        companyId,
        status: status || 'APPROVED' // Default to approved unless specified
      },
      account: {
        accountType: { name: 'RECEIVABLE' }
      }
    };

    if (customerName) {
      where.customer = { name: { contains: customerName, mode: 'insensitive' } };
    }

    if (reference) {
      where.journalEntry.reference = { contains: reference, mode: 'insensitive' };
    }

    if (startDate || endDate) {
      where.journalEntry.date = {};
      if (startDate) where.journalEntry.date.gte = new Date(startDate);
      if (endDate) where.journalEntry.date.lte = new Date(endDate);
    }

    if (branchId) where.branchId = branchId;

    if (minAmount || maxAmount) {
      where.debitBase = {};
      if (minAmount) where.debitBase.gte = parseFloat(minAmount);
      if (maxAmount) where.debitBase.lte = parseFloat(maxAmount);
    }

    const lines = await prisma.journalEntryLine.findMany({
      where,
      include: {
        journalEntry: true,
        customer: true,
        account: true,
        branch: true
      },
      orderBy: { journalEntry: { date: 'desc' } }
    });

    // 4. Role-based result modification (Owner/Accountant see all, others might see masked data)
    const isPowerful = ['Owner', 'Accountant', 'Admin'].includes(role);
    
    // If not powerful, maybe omit some sensitive details or system-level accounts (already filtered to RECEIVABLE)
    // For now, returning as is, but structure is ready for masking.

    return reply.send({ success: true, data: lines });
  }

  async getLCLiability(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const lcs = await prisma.lC.findMany({
      where: { companyId, status: 'OPEN' }
    });
    
    // In a real system, you'd match these with payment vouchers
    return reply.send({ success: true, data: lcs });
  }

  async getLedger(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { accountId } = request.query as { accountId?: string };
    const filters = this.buildLineFilters(request.query);

    if (accountId) filters.accountId = accountId;

    const journals = await prisma.journalEntryLine.findMany({
      where: {
        ...filters,
        journalEntry: { ...filters.journalEntry, companyId }
      },
      include: {
        journalEntry: {
          include: { createdBy: { select: { firstName: true, lastName: true } } }
        },
        account: true,
        project: true,
        branch: true
      },
      orderBy: { journalEntry: { date: 'asc' } }
    });

    return reply.send({ success: true, data: journals });
  }
}
