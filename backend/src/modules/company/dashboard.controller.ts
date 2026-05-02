import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { NotFoundError } from '../../middleware/errorHandler';

/**
 * Auto-generate notifications from real database events.
 * Deduplicates so the same event doesn't create duplicate unread alerts.
 */
async function generateNotifications(companyId: string) {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // 1. Overdue Invoices
  const existingInvoiceNotifs = await prisma.notification.findMany({
    where: { companyId, type: 'OVERDUE_INVOICE', isRead: false },
    select: { entityId: true }
  });
  const notifiedInvoiceIds = existingInvoiceNotifs.map((n: any) => n.entityId);

  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      companyId,
      status: 'APPROVED',
      dueDate: { lt: now },
      id: { notIn: notifiedInvoiceIds }
    },
    select: { id: true, invoiceNumber: true, total: true, dueDate: true },
    take: 5,
  });

  if (overdueInvoices.length > 0) {
    await prisma.notification.createMany({
      data: overdueInvoices.map(inv => {
        const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate!).getTime()) / 86400000);
        return {
          companyId, type: 'OVERDUE_INVOICE', severity: 'DANGER',
          title: `Overdue Invoice: ${inv.invoiceNumber}`,
          message: `Invoice ${inv.invoiceNumber} is ${daysOverdue} day(s) overdue. Amount: ৳${Number(inv.total).toLocaleString()}.`,
          entityType: 'Invoice', entityId: inv.id,
        };
      })
    });
  }

  // 2. LCs Expiring
  const existingLCNotifs = await prisma.notification.findMany({
    where: { companyId, type: 'LC_EXPIRY', isRead: false },
    select: { entityId: true }
  });
  const notifiedLCIds = existingLCNotifs.map((n: any) => n.entityId);

  const expiringLCs = await prisma.lC.findMany({
    where: {
      companyId,
      status: 'OPEN',
      expiryDate: { lte: in7Days, gte: now },
      id: { notIn: notifiedLCIds }
    },
    select: { id: true, lcNumber: true, amount: true, currency: true, expiryDate: true, conversionRate: true },
    take: 5,
  });

  if (expiringLCs.length > 0) {
    await prisma.notification.createMany({
      data: expiringLCs.map(lc => {
        const daysLeft = Math.floor((new Date(lc.expiryDate).getTime() - now.getTime()) / 86400000);
        const convRate = (lc as any).conversionRate || 1;
        return {
          companyId, type: 'LC_EXPIRY', severity: daysLeft <= 3 ? 'DANGER' : 'WARNING',
          title: `LC Expiry Alert: ${lc.lcNumber}`,
          message: `LC ${lc.lcNumber} expires in ${daysLeft} day(s). Value: ${Number(lc.amount).toLocaleString()} ${lc.currency} (৳${Number(lc.amount * convRate).toLocaleString()}).`,
          entityType: 'LC', entityId: lc.id,
        };
      })
    });
  }

  // 3. Pending Journals
  const pendingCount = await prisma.journalEntry.count({ where: { companyId, status: 'PENDING_VERIFICATION' } });
  if (pendingCount > 0) {
    const existing = await prisma.notification.findFirst({
      where: { companyId, type: 'PENDING_JOURNAL', isRead: false },
    });
    if (!existing) {
      await prisma.notification.create({
        data: {
          companyId, type: 'PENDING_JOURNAL', severity: 'WARNING',
          title: 'Journals Awaiting Verification',
          message: `${pendingCount} journal entr${pendingCount > 1 ? 'ies are' : 'y is'} awaiting manager verification.`,
          entityType: 'JournalEntry',
        },
      });
    }
  }

  // 4. Loans Due
  const existingLoanNotifs = await prisma.notification.findMany({
    where: { companyId, type: 'LOAN_DUE', isRead: false },
    select: { entityId: true }
  });
  const notifiedLoanIds = existingLoanNotifs.map((n: any) => n.entityId);

  const dueLoans = await prisma.loan.findMany({
    where: {
      companyId,
      status: 'ACTIVE',
      endDate: { lte: in30Days, gte: now },
      id: { notIn: notifiedLoanIds }
    },
    select: { id: true, loanNumber: true, outstandingBalance: true, endDate: true },
    take: 5,
  });

  if (dueLoans.length > 0) {
    await prisma.notification.createMany({
      data: dueLoans.map(loan => {
        const daysLeft = Math.floor((new Date(loan.endDate!).getTime() - now.getTime()) / 86400000);
        return {
          companyId, type: 'LOAN_DUE', severity: 'WARNING',
          title: `Loan Maturity: ${loan.loanNumber}`,
          message: `Loan ${loan.loanNumber} matures in ${daysLeft} day(s). Outstanding: ৳${Number(loan.outstandingBalance).toLocaleString()}.`,
          entityType: 'Loan', entityId: loan.id,
        };
      })
    });
  }
}

export class DashboardController {
  async getStats(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    console.log(`[DashboardStats] Fetching for User: ${userId}, Company: ${companyId}`);

    // 1. Get User's Role & Access in this Company
    let userCompany = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
      include: {
        user: { include: { userRoles: { include: { role: true } } } },
        company: true
      }
    });

    if (!userCompany) {
      // Check if user is a Global Admin
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { userRoles: { include: { role: true } } }
      });

      const isAdmin = user?.userRoles.some(ur => ur.role.name === 'Admin');

      if (isAdmin) {
        // Mock a userCompany object for admins to allow access
        const company = await prisma.company.findUnique({ where: { id: companyId } });
        if (!company) throw new NotFoundError('Company not found');

        userCompany = {
          userId,
          companyId,
          user,
          company,
          isMainOwner: true, // Admins get full view
          ownershipPercentage: 0,
        } as any;
      } else {
        console.warn(`[DashboardStats] Access Denied: User ${userId} not in Company ${companyId}`);
        return reply.status(403).send({ success: false, message: 'Access denied: You are not a member of this company' });
      }
    }

    let roleName = 'User';
    let company;

    if (userCompany) {
      company = userCompany.company;
      roleName = userCompany.user.userRoles[0]?.role?.name || 'User';
    } else {
      // Global admin / owner bypass (we already checked permissions above)
      company = await prisma.company.findUnique({ where: { id: companyId } });
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { userRoles: { include: { role: true } } }
      });
      const isGlobalOwner = user?.userRoles.some((ur: any) => ur.role.name === 'Owner');
      roleName = isGlobalOwner ? 'Owner' : 'Admin';
    }

    if (!company) {
      return reply.status(404).send({ success: false, message: 'Company not found' });
    }

    const companyName = company.name;
    console.log(`[DashboardStats] User Role: ${roleName} (Global Admin/Owner bypass: ${!userCompany})`);
    try {
      // 2. Fetch all necessary data in parallel where possible
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      // Auto-generate notifications (Optimized call)
      await generateNotifications(companyId);

      // 3. Batched Financial Stats using GroupBy/Aggregate
      // Fetch all relevant account types/categories balances in one or two queries

      // Get all active accounts for this company with their types
      const accounts = await prisma.account.findMany({
        where: { companyId, isActive: true },
        include: { accountType: true }
      });

      const accountMap = new Map(accounts.map(a => [a.id, a]));
      const cashBankIds = accounts.filter(a => a.category === 'CASH' || a.category === 'BANK').map(a => a.id);
      const receivableAccountIds = accounts.filter(a => a.accountType.name === 'ASSET' && a.name.toLowerCase().includes('receivable')).map(a => a.id);
      const payableAccountIds = accounts.filter(a => a.accountType.name === 'LIABILITY' && a.name.toLowerCase().includes('payable')).map(a => a.id);
      const loanAccountIds = accounts.filter(a => a.accountType.name === 'LIABILITY' && a.name.toLowerCase().includes('loan')).map(a => a.id);

      // Aggregated Ledger Data (Lifetime)
      const lifetimeStats = await prisma.journalEntryLine.groupBy({
        by: ['accountId'],
        where: { journalEntry: { companyId, status: 'APPROVED' } },
        _sum: { debitBase: true, creditBase: true }
      });

      const getBalance = (ids: string[], type: 'DEBIT' | 'CREDIT') => {
        const relevantLines = lifetimeStats.filter(s => ids.includes(s.accountId));
        return relevantLines.reduce((sum, s) => {
          const deb = Number(s._sum.debitBase || 0);
          const cre = Number(s._sum.creditBase || 0);
          return sum + (type === 'DEBIT' ? (deb - cre) : (cre - deb));
        }, 0);
      };

      const cashBalance = getBalance(cashBankIds, 'DEBIT');
      const totalReceivables = getBalance(receivableAccountIds, 'DEBIT');
      const totalPayables = getBalance(payableAccountIds, 'CREDIT');
      const totalLoanOutstanding = getBalance(loanAccountIds, 'CREDIT');

      // Lifetime Revenue/Expense/Assets/Liabilities/Equity
      const allAssetIds = accounts.filter(a => a.accountType.name === 'ASSET').map(a => a.id);
      const allLiabilityIds = accounts.filter(a => a.accountType.name === 'LIABILITY').map(a => a.id);
      const allEquityIds = accounts.filter(a => a.accountType.name === 'EQUITY').map(a => a.id);
      const allIncomeIds = accounts.filter(a => a.accountType.name === 'INCOME' || a.accountType.name === 'REVENUE').map(a => a.id);
      const allExpenseIds = accounts.filter(a => a.accountType.name === 'EXPENSE').map(a => a.id);

      const totalAssets = getBalance(allAssetIds, 'DEBIT');
      const totalLiabilities = getBalance(allLiabilityIds, 'CREDIT');
      const totalEquity = getBalance(allEquityIds, 'CREDIT');
      const totalRevenue = getBalance(allIncomeIds, 'CREDIT');
      const totalExpensesOverview = getBalance(allExpenseIds, 'DEBIT');

      // Month-specific Revenue
      const monthRevenueStats = await prisma.journalEntryLine.groupBy({
        by: ['accountId'],
        where: {
          journalEntry: { companyId, status: 'APPROVED', date: { gte: startOfLastMonth } },
          accountId: { in: allIncomeIds }
        },
        _sum: { debitBase: true, creditBase: true }
      });

      // Filter for current and last month manually to save queries
      // We need the date, but groupBy date is tricky. Let's do 2 aggregates for speed or fetch lines if small.
      // Actually, 2 aggregate queries are very fast compared to O(N) loops.

      const currentMonthRevenueAgg = await prisma.journalEntryLine.aggregate({
        where: {
          journalEntry: { companyId, status: 'APPROVED', date: { gte: startOfMonth } },
          accountId: { in: allIncomeIds }
        },
        _sum: { debitBase: true, creditBase: true }
      });
      const currentMonthRevenue = Number(currentMonthRevenueAgg._sum.creditBase || 0) - Number(currentMonthRevenueAgg._sum.debitBase || 0);

      const lastMonthRevenueAgg = await prisma.journalEntryLine.aggregate({
        where: {
          journalEntry: { companyId, status: 'APPROVED', date: { gte: startOfLastMonth, lte: endOfLastMonth } },
          accountId: { in: allIncomeIds }
        },
        _sum: { debitBase: true, creditBase: true }
      });
      const lastMonthRevenue = Number(lastMonthRevenueAgg._sum.creditBase || 0) - Number(lastMonthRevenueAgg._sum.debitBase || 0);

      let growthPercent = 0;
      if (lastMonthRevenue > 0) growthPercent = ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
      else if (currentMonthRevenue > 0) growthPercent = 100;

      const netCashPosition = cashBalance + totalReceivables - totalPayables - totalLoanOutstanding;
      const currentRatio = (totalPayables + totalLoanOutstanding) > 0
        ? (cashBalance + totalReceivables) / (totalPayables + totalLoanOutstanding)
        : 0;

      const accountingEquation = {
        assets: totalAssets,
        liabilities: totalLiabilities,
        ap: totalPayables,
        equity: totalEquity,
        revenue: totalRevenue,
        expenses: totalExpensesOverview,
        netIncome: totalRevenue - totalExpensesOverview,
        isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity + (totalRevenue - totalExpensesOverview))) < 1
      };

      // 4. Fetch Activities & Notifications
      const [activityLogs, unreadCount, lastBackup] = await Promise.all([
        prisma.activityLog.findMany({
          where: { companyId },
          include: {
            performedBy: { select: { id: true, firstName: true, lastName: true } },
            targetUser: { select: { id: true, firstName: true, lastName: true } }
          },
          orderBy: { createdAt: 'desc' },
          take: 20
        }),
        prisma.notification.count({ where: { companyId, isRead: false } }),
        prisma.backupLog.findFirst({
          where: { status: 'SUCCESS', fileName: { contains: companyId } },
          orderBy: { createdAt: 'desc' }
        })
      ]);

      const activities = activityLogs.map((log: any) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        performedBy: log.performedBy,
        targetUser: log.targetUser,
        metadata: log.metadata,
        createdAt: log.createdAt,
      }));

      // --- Breakdown Data (Optimized) ---
      const revenueBreakdown = allIncomeIds.map(id => {
        const acc = accountMap.get(id);
        const stat = lifetimeStats.find(s => s.accountId === id);
        const balance = stat ? Number(stat._sum.creditBase || 0) - Number(stat._sum.debitBase || 0) : 0;
        return { name: acc?.name || 'Unknown', currentBalance: balance };
      }).filter(a => Math.abs(a.currentBalance) > 0.01);

      const cashBreakdown = cashBankIds.map(id => {
        const acc = accountMap.get(id);
        const stat = lifetimeStats.find(s => s.accountId === id);
        const balance = stat ? Number(stat._sum.debitBase || 0) - Number(stat._sum.creditBase || 0) : 0;
        return { name: acc?.name || 'Unknown', currentBalance: balance };
      }).filter(a => Math.abs(a.currentBalance) > 0.01);

      // Receivables/Payables by Entity (Need separate queries but batched)
      const [customerReceivables, vendorPayables, loanRecords] = await Promise.all([
        prisma.customer.findMany({
          where: { companyId, isActive: true },
          include: { journalLines: { where: { journalEntry: { status: 'APPROVED' }, accountId: { in: receivableAccountIds } } } }
        }),
        prisma.vendor.findMany({
          where: { companyId, isActive: true },
          include: { journalLines: { where: { journalEntry: { status: 'APPROVED' }, accountId: { in: payableAccountIds } } } }
        }),
        prisma.loan.findMany({
          where: { companyId, status: 'ACTIVE' },
          select: { bankName: true, principalAmount: true, outstandingBalance: true, monthlyInstallment: true, endDate: true }
        })
      ]);

      const receivablesBreakdown = customerReceivables.map((c: any) => ({
        name: c.name,
        balance: c.journalLines.reduce((sum: number, l: any) => sum + (Number(l.debitBase) - Number(l.creditBase)), 0)
      })).filter((c: any) => Math.abs(c.balance) > 0.01);

      const payablesBreakdown = vendorPayables.map((v: any) => ({
        name: v.name,
        balance: v.journalLines.reduce((sum: number, l: any) => sum + (Number(l.creditBase) - Number(l.debitBase)), 0)
      })).filter((v: any) => Math.abs(v.balance) > 0.01);

      let loanBreakdownArr: any[] = loanRecords.length > 0 ? loanRecords : loanAccountIds.map(id => {
        const acc = accountMap.get(id);
        const stat = lifetimeStats.find(s => s.accountId === id);
        return {
          bankName: acc?.name || 'Unknown',
          principalAmount: acc?.openingBalance || 0,
          outstandingBalance: stat ? Number(stat._sum.creditBase || 0) - Number(stat._sum.debitBase || 0) : 0,
          monthlyInstallment: 0,
          endDate: null
        };
      }).filter(a => Math.abs(a.outstandingBalance) > 0.01);

      // --- Buyer Distribution (Optimized) ---
      const buyerDistribution = customerReceivables.map((b: any) => ({
        name: b.name,
        value: Math.abs(b.journalLines.filter((l: any) => allIncomeIds.includes(l.accountId)).reduce((sum: number, l: any) => sum + (Number(l.creditBase) - Number(l.debitBase)), 0))
      })).filter((b: any) => b.value > 0).sort((a: any, b: any) => b.value - a.value);

      // --- Revenue vs Expense & Cash Flow Trends (Optimized) ---
      // We fetch all relevant lines for last 6 months once and aggregate in memory
      const trendLines = await prisma.journalEntryLine.findMany({
        where: {
          journalEntry: { companyId, status: 'APPROVED', date: { gte: sixMonthsAgo } },
          OR: [
            { accountId: { in: allIncomeIds } },
            { accountId: { in: allExpenseIds } },
            { account: { cashFlowType: { not: null } } }
          ]
        },
        include: { journalEntry: { select: { date: true } }, account: { select: { cashFlowType: true, accountType: { select: { name: true } } } } }
      });

      const revExpTrend: any[] = [];
      const cashFlowTrend: any[] = [];
      const liquidityTrend: any[] = [];

      for (let i = 0; i < 6; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        const month = d.getMonth();
        const year = d.getFullYear();
        const monthName = d.toLocaleString('default', { month: 'short' });

        const monthLines = trendLines.filter(l => {
          const lDate = new Date(l.journalEntry.date);
          return lDate.getMonth() === month && lDate.getFullYear() === year;
        });

        const rev = monthLines.filter(l => allIncomeIds.includes(l.accountId))
          .reduce((sum, l) => sum + (Number(l.creditBase) - Number(l.debitBase)), 0);
        const exp = monthLines.filter(l => allExpenseIds.includes(l.accountId))
          .reduce((sum, l) => sum + (Number(l.debitBase) - Number(l.creditBase)), 0);
        const cf = monthLines.filter(l => l.account.cashFlowType)
          .reduce((sum, l) => sum + (Number(l.creditBase) - Number(l.debitBase)), 0);

        revExpTrend.push({ name: monthName, revenue: rev, expense: exp });
        cashFlowTrend.push({ name: monthName, value: cf });
      }

      // Liquidity Trend (Cumulative Cash)
      let currentC = cashBalance;
      for (let i = 5; i >= 0; i--) {
        liquidityTrend[i] = { name: cashFlowTrend[i].name, value: currentC };
        currentC -= cashFlowTrend[i].value;
      }

      // --- Cash Flow Breakdown (Current Month) ---
      const currentMonthCFLines = trendLines.filter(l => {
        const lDate = new Date(l.journalEntry.date);
        return lDate >= startOfMonth;
      });

      const cfBreakdown = {
        operating: { inflows: 0, outflows: 0, net: 0 },
        investing: { inflows: 0, outflows: 0, net: 0 },
        financing: { inflows: 0, outflows: 0, net: 0 },
        netCashFlow: 0
      };

      for (const line of currentMonthCFLines) {
        if (!line.account.cashFlowType) continue;
        const amount = Number(line.creditBase) - Number(line.debitBase);
        const target = line.account.cashFlowType.toLowerCase() as 'operating' | 'investing' | 'financing';
        if (amount > 0) cfBreakdown[target].inflows += amount;
        else cfBreakdown[target].outflows += Math.abs(amount);
      }

      ['operating', 'investing', 'financing'].forEach((k: any) => {
        (cfBreakdown as any)[k].net = (cfBreakdown as any)[k].inflows - (cfBreakdown as any)[k].outflows;
      });
      cfBreakdown.netCashFlow = cfBreakdown.operating.net + cfBreakdown.investing.net + cfBreakdown.financing.net;

      const cashFlowData = {
        openingCash: cashBalance - cfBreakdown.netCashFlow,
        ...cfBreakdown,
        closingCash: cashBalance
      };

      // Final Assembly
      const enrichedActivities = activities.map((act: any) => {
        let link = null;
        const eType = String(act.entityType).toLowerCase();
        if (eType === 'invoice') link = `/company/${companyId}/sales/invoices`;
        else if (eType === 'po') link = `/company/${companyId}/purchase/orders`;
        else if (eType === 'journal') link = `/company/${companyId}/journals`;
        else if (eType === 'pi') link = `/company/${companyId}/purchase/pis`;
        else if (eType === 'lc') link = `/company/${companyId}/finance/lcs`;
        return { ...act, link };
      });

      const dashboardData = {
        role: roleName,
        companyName,
        kpis: {
          revenue: { value: totalRevenue, thisMonth: currentMonthRevenue, lastMonth: lastMonthRevenue, growth: growthPercent, breakdown: revenueBreakdown.map(r => ({ label: r.name, amount: r.currentBalance })) },
          cash: { value: cashBalance, breakdown: cashBreakdown.map(c => ({ label: c.name, amount: c.currentBalance })), movement: { received: cfBreakdown.operating.inflows + cfBreakdown.investing.inflows + cfBreakdown.financing.inflows, paid: cfBreakdown.operating.outflows + cfBreakdown.investing.outflows + cfBreakdown.financing.outflows } },
          monthlyCashFlow: cashFlowData,
          receivables: { value: totalReceivables, breakdown: receivablesBreakdown.map(r => ({ label: r.name, amount: r.balance })) },
          payables: { value: totalPayables, breakdown: payablesBreakdown.map(p => ({ label: p.name, amount: p.balance })) },
          loans: { value: totalLoanOutstanding, breakdown: loanBreakdownArr.map(l => ({ label: l.bankName, principal: l.principalAmount, outstanding: l.outstandingBalance, nextEMI: { amount: l.monthlyInstallment, dueDate: l.endDate } })) },
          netCash: { value: netCashPosition, breakdown: [{ label: 'Cash & Bank', amount: cashBalance }, { label: 'Receivables', amount: totalReceivables }, { label: 'Payables', amount: -totalPayables }, { label: 'Loans', amount: -totalLoanOutstanding }] },
          currentRatio: { value: currentRatio, breakdown: [{ label: 'Current Assets', amount: cashBalance + totalReceivables }, { label: 'Current Liabilities', amount: totalPayables + totalLoanOutstanding }] }
        },
        charts: [
          { name: 'Revenue vs Expenses', data: revExpTrend, type: 'BAR' },
          { name: 'Revenue by Buyer', data: buyerDistribution, type: 'PIE' },
          { name: 'Monthly Net Cash Flow', data: cashFlowTrend, type: 'LINE' },
          { name: 'Cash Position', data: cashBreakdown.map(c => ({ name: c.name, value: c.currentBalance })), type: 'BAR' }
        ],
        accountingEquation,
        alerts: enrichedActivities,
        unreadCount,
        lastBackup: lastBackup ? { timestamp: lastBackup.createdAt, fileName: lastBackup.fileName, status: lastBackup.status } : null,
        actions: []
      };

      // Role-based actions
      if (roleName === 'Owner' || roleName === 'Admin') {
        dashboardData.actions = [
          { label: 'View Reports', href: `/company/${companyId}/reports`, icon: 'FileBarChart' },
          { label: 'Owner Profile', href: `/owner/owners`, icon: 'User' },
          { label: 'Manage Finance', href: `/company/${companyId}/finance`, icon: 'Briefcase' },
          { label: 'New Voucher', href: `/company/${companyId}/journals`, icon: 'Plus' }
        ];
      }

      return reply.send({ success: true, data: dashboardData });
    } catch (error: any) {
      console.error(`[DashboardStats] CRITICAL ERROR for ${companyId}:`, error);
      return reply.status(500).send({ success: false, message: 'Internal Server Error', detail: error?.message });
    }
  }

  async getActivities(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { limit } = request.query as { limit?: string };
    const take = parseInt(limit || '10', 10);

    try {
      const activities = await prisma.activityLog.findMany({
        where: { companyId },
        select: {
          id: true,
          companyId: true,
          entityType: true,
          entityId: true,
          action: true,
          metadata: true,
          createdAt: true,
          performedBy: { select: { id: true, firstName: true, lastName: true } },
          targetUser: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: { createdAt: 'desc' },
        take
      });

      return reply.send({ success: true, data: activities });
    } catch (error) {
      console.error(`[DashboardActivities] ERROR for ${companyId}:`, error);
      return reply.status(500).send({ success: false, message: 'Internal Server Error while fetching activities' });
    }
  }
}
