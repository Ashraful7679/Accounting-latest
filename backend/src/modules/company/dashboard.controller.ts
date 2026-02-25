import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';

/**
 * Auto-generate notifications from real database events.
 * Deduplicates so the same event doesn't create duplicate unread alerts.
 */
async function generateNotifications(companyId: string) {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // 1. Overdue Invoices
  const overdueInvoices = await prisma.invoice.findMany({
    where: { companyId, status: 'APPROVED', dueDate: { lt: now } },
    select: { id: true, invoiceNumber: true, total: true, dueDate: true },
    take: 10,
  });
  for (const inv of overdueInvoices) {
    const existing = await prisma.notification.findFirst({
      where: { companyId, type: 'OVERDUE_INVOICE', entityId: inv.id, isRead: false },
    });
    if (!existing) {
      const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate!).getTime()) / 86400000);
      await prisma.notification.create({
        data: {
          companyId, type: 'OVERDUE_INVOICE', severity: 'DANGER',
          title: `Overdue Invoice: ${inv.invoiceNumber}`,
          message: `Invoice ${inv.invoiceNumber} is ${daysOverdue} day(s) overdue. Amount: ৳${Number(inv.total).toLocaleString()}.`,
          entityType: 'Invoice', entityId: inv.id,
        },
      });
    }
  }

  // 2. LCs Expiring within 7 Days
  const expiringLCs = await prisma.lC.findMany({
    where: { companyId, status: 'OPEN', expiryDate: { lte: in7Days, gte: now } },
    select: { id: true, lcNumber: true, amount: true, currency: true, expiryDate: true, conversionRate: true },
    take: 10,
  });
  for (const lc of expiringLCs) {
    const existing = await prisma.notification.findFirst({
      where: { companyId, type: 'LC_EXPIRY', entityId: lc.id, isRead: false },
    });
    if (!existing) {
      const daysLeft = Math.floor((new Date(lc.expiryDate).getTime() - now.getTime()) / 86400000);
      const convRate = (lc as any).conversionRate || 1;
      await prisma.notification.create({
        data: {
          companyId, type: 'LC_EXPIRY', severity: daysLeft <= 3 ? 'DANGER' : 'WARNING',
          title: `LC Expiry Alert: ${lc.lcNumber}`,
          message: `LC ${lc.lcNumber} expires in ${daysLeft} day(s). Value: ${Number(lc.amount).toLocaleString()} ${lc.currency} (৳${Number(lc.amount * convRate).toLocaleString()}).`,
          entityType: 'LC', entityId: lc.id,
        },
      });
    }
  }

  // 3. Pending Journal Entries (Awaiting Verification)
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

  // 4. Active Loans Due within 30 Days
  const dueLoans = await prisma.loan.findMany({
    where: { companyId, status: 'ACTIVE', endDate: { lte: in30Days, gte: now } },
    select: { id: true, loanNumber: true, outstandingBalance: true, endDate: true },
    take: 5,
  });
  for (const loan of dueLoans) {
    const existing = await prisma.notification.findFirst({
      where: { companyId, type: 'LOAN_DUE', entityId: loan.id, isRead: false },
    });
    if (!existing) {
      const daysLeft = Math.floor((new Date(loan.endDate!).getTime() - now.getTime()) / 86400000);
      await prisma.notification.create({
        data: {
          companyId, type: 'LOAN_DUE', severity: 'WARNING',
          title: `Loan Maturity: ${loan.loanNumber}`,
          message: `Loan ${loan.loanNumber} matures in ${daysLeft} day(s). Outstanding: ৳${Number(loan.outstandingBalance).toLocaleString()}.`,
          entityType: 'Loan', entityId: loan.id,
        },
      });
    }
  }
}

export class DashboardController {
  async getStats(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    console.log(`[DashboardStats] Fetching for User: ${userId}, Company: ${companyId}`);

    // 1. Get User's Role & Access in this Company
    const userCompany = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
      include: {
        user: { include: { userRoles: { include: { role: true } } } },
        company: true
      }
    });

    if (!userCompany) {
      console.warn(`[DashboardStats] Access Denied: User ${userId} not in Company ${companyId}`);
      return reply.status(403).send({ success: false, message: 'Access denied: You are not a member of this company' });
    }

    const roleName = userCompany.user.userRoles[0]?.role?.name || 'User';
    console.log(`[DashboardStats] User Role: ${roleName}`);

    try {
      // 2. Auto-generate real notifications from DB events
      await generateNotifications(companyId);

      // 3. Fetch Base Financial Stats
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      // Revenue Calculation helper
      const getRevenue = async (from?: Date, to?: Date) => {
        const where: any = {
          journalEntry: {
            companyId,
            status: 'APPROVED',
          },
          account: {
            accountType: { name: 'INCOME' }
          }
        };
        if (from || to) {
          where.journalEntry.date = {};
          if (from) where.journalEntry.date.gte = from;
          if (to) where.journalEntry.date.lte = to;
        }

        const lines = await prisma.journalEntryLine.findMany({ where });
        return lines.reduce((sum: number, l) => sum + (Number(l.creditBase) - Number(l.debitBase)), 0);
      };

      const currentMonthRevenue = await getRevenue(startOfMonth);
      const lastMonthRevenue = await getRevenue(startOfLastMonth, endOfLastMonth);

      let growthPercent = 0;
      if (lastMonthRevenue > 0) {
        growthPercent = ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
      } else if (currentMonthRevenue > 0) {
        growthPercent = 100;
      }

      // Cash & Bank (Dynamic from Ledger)
      const cashLines = await prisma.journalEntryLine.findMany({
        where: {
          journalEntry: { companyId, status: 'APPROVED' },
          account: {
            accountType: { name: 'ASSET' },
            OR: [
              { name: { contains: 'Cash', mode: 'insensitive' } },
              { name: { contains: 'Bank', mode: 'insensitive' } }
            ]
          }
        }
      });
      const cashBalance = cashLines.reduce((sum, l) => sum + (Number(l.debitBase) - Number(l.creditBase)), 0);

      // Receivables (Dynamic from Ledger)
      const recLines = await prisma.journalEntryLine.findMany({
        where: {
          journalEntry: { companyId, status: 'APPROVED' },
          account: {
            accountType: { name: 'ASSET' },
            name: { contains: 'Receivable', mode: 'insensitive' }
          }
        }
      });
      const totalReceivables = recLines.reduce((sum, l) => sum + (Number(l.debitBase) - Number(l.creditBase)), 0);

      // Payables (Dynamic from Ledger)
      const payLines = await prisma.journalEntryLine.findMany({
        where: {
          journalEntry: { companyId, status: 'APPROVED' },
          account: {
            accountType: { name: 'LIABILITY' },
            name: { contains: 'Payable', mode: 'insensitive' }
          }
        }
      });
      const totalPayables = payLines.reduce((sum, l) => sum + (Number(l.creditBase) - Number(l.debitBase)), 0);

      // Loans (Dynamic from Ledger)
      const loanLines = await prisma.journalEntryLine.findMany({
        where: {
          journalEntry: { companyId, status: 'APPROVED' },
          account: {
            accountType: { name: 'LIABILITY' },
            name: { contains: 'Loan', mode: 'insensitive' }
          }
        }
      });
      const totalLoanOutstanding = loanLines.reduce((sum, l) => sum + (Number(l.creditBase) - Number(l.debitBase)), 0);

      const netCashPosition = cashBalance + totalReceivables - totalPayables - totalLoanOutstanding;
      const currentRatio = (totalPayables + totalLoanOutstanding) > 0 
        ? (cashBalance + totalReceivables) / (totalPayables + totalLoanOutstanding) 
        : 0;

      // Unread alerts (Priority Alerts)
      const liveNotifications = await prisma.notification.findMany({
        where: { companyId, isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const alerts = liveNotifications.map((n: any) => ({
        id: n.id,
        type: n.severity === 'DANGER' ? 'danger' : n.severity === 'WARNING' ? 'warning' : 'info',
        title: n.title,
        message: n.message,
        createdAt: n.createdAt,
      }));

      const unreadCount = await prisma.notification.count({ where: { companyId, isRead: false } });
      
      // Last Backup Info
      const lastBackup = await prisma.backupLog.findFirst({
        where: { status: 'SUCCESS' },
        orderBy: { createdAt: 'desc' }
      });

      const companyName = userCompany.company.name;

      // --- Enhanced Breakdown Data for Hover Popups ---
      
      // Revenue Breakdown (Dynamic)
      const revenueAccounts = await prisma.account.findMany({
        where: { companyId, accountType: { name: 'INCOME' }, isActive: true },
        include: { journalLines: { where: { journalEntry: { status: 'APPROVED' } } } }
      });
      const revenueBreakdown = revenueAccounts.map(acc => ({
        name: acc.name,
        currentBalance: acc.journalLines.reduce((sum, l) => sum + (Number(l.creditBase) - Number(l.debitBase)), 0)
      })).filter(a => Math.abs(a.currentBalance) > 0.01);

      // Cash & Bank Breakdown (Dynamic)
      const cashAccounts = await prisma.account.findMany({
        where: { 
          companyId, 
          accountType: { name: 'ASSET' }, 
          isActive: true,
          OR: [
            { name: { contains: 'Cash', mode: 'insensitive' } },
            { name: { contains: 'Bank', mode: 'insensitive' } }
          ]
        },
        include: { journalLines: { where: { journalEntry: { status: 'APPROVED' } } } }
      });
      const cashBreakdown = cashAccounts.map(acc => ({
        name: acc.name,
        currentBalance: acc.journalLines.reduce((sum, l) => sum + (Number(l.debitBase) - Number(l.creditBase)), 0)
      })).filter(a => Math.abs(a.currentBalance) > 0.01);

      // Receivables Breakdown (by Customer if linked, else Account)
      const customerReceivables = await prisma.customer.findMany({
        where: { companyId, isActive: true },
        include: { journalLines: { where: { journalEntry: { status: 'APPROVED' } } } }
      });
      const receivablesBreakdown = customerReceivables.map(c => {
        const balance = c.journalLines.reduce((sum, l) => sum + (Number(l.debitBase) - Number(l.creditBase)), 0);
        return { name: c.name, balance };
      }).filter(c => Math.abs(c.balance) > 0.01);

      // Payables Breakdown
      const vendorPayables = await prisma.vendor.findMany({
        where: { companyId, isActive: true },
        include: { journalLines: { where: { journalEntry: { status: 'APPROVED' } } } }
      });
      const payablesBreakdown = vendorPayables.map(v => {
        const balance = v.journalLines.reduce((sum, l) => sum + (Number(l.creditBase) - Number(l.debitBase)), 0);
        return { name: v.name, balance };
      }).filter(v => Math.abs(v.balance) > 0.01);

      // Loan Breakdown: first try structured Loan records, fallback to ledger accounts
      const loanRecords = await prisma.loan.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: { bankName: true, principalAmount: true, outstandingBalance: true, monthlyInstallment: true, endDate: true }
      });

      // If no Loan records, derive breakdown from loan-related ledger accounts
      let loanBreakdown: any[] = [];
      if (loanRecords.length > 0) {
        loanBreakdown = loanRecords; // use structured loan records
      } else {
        // Fallback: use loan accounts from COA
        const loanAccounts = await prisma.account.findMany({
          where: {
            companyId, isActive: true,
            accountType: { name: 'LIABILITY' },
            name: { contains: 'Loan', mode: 'insensitive' }
          },
          include: { journalLines: { where: { journalEntry: { status: 'APPROVED' as any } } } }
        });
        loanBreakdown = loanAccounts.map(acc => ({
          bankName: acc.name,
          principalAmount: acc.openingBalance,
          outstandingBalance: acc.journalLines.reduce((sum: number, l: any) => sum + (Number(l.creditBase) - Number(l.debitBase)), 0),
          monthlyInstallment: 0,
          endDate: null
        })).filter((a: any) => Math.abs(a.outstandingBalance) > 0.01);
      }

      // --- New: Buyer-wise Distribution for Pie Chart ---
      const buyers = await prisma.customer.findMany({
        where: { companyId, isActive: true },
        include: {
          journalLines: {
            where: {
              journalEntry: { status: 'APPROVED', date: { gte: startOfMonth } },
              account: { accountType: { name: 'INCOME' } }
            }
          }
        }
      });
      const buyerDistribution = buyers.map(b => ({
        name: b.name,
        value: b.journalLines.reduce((sum, l) => sum + (l.creditBase - l.debitBase), 0)
      })).filter(b => b.value > 0).sort((a, b) => b.value - a.value);

      // 4. --- RMG Monthly Cash Flow Overhaul ---
      const cashFlowData = await (async () => {
        const getCashFlowForPeriod = async (from: Date, to: Date) => {
          const lines = await prisma.journalEntryLine.findMany({
            where: {
              journalEntry: { companyId, status: 'APPROVED' as any, date: { gte: from, lte: to } },
              account: { cashFlowType: { not: null } }
            },
            include: { account: true }
          });

          let operating = { inflows: 0, outflows: 0, net: 0 };
          let investing = { inflows: 0, outflows: 0, net: 0 };
          let financing = { inflows: 0, outflows: 0, net: 0 };

          for (const line of lines) {
            const amount = Number(line.creditBase) - Number(line.debitBase); // Positive for Credit, Negative for Debit
            const cfType = line.account.cashFlowType;

            if (cfType === 'OPERATING') {
              if (amount > 0) operating.inflows += amount;
              else operating.outflows += Math.abs(amount);
            } else if (cfType === 'INVESTING') {
              if (amount > 0) investing.inflows += amount;
              else investing.outflows += Math.abs(amount);
            } else if (cfType === 'FINANCING') {
              if (amount > 0) financing.inflows += amount;
              else financing.outflows += Math.abs(amount);
            }
          }
          
          operating.net = operating.inflows - operating.outflows;
          investing.net = investing.inflows - investing.outflows;
          financing.net = financing.inflows - financing.outflows;

          return { operating, investing, financing, net: operating.net + investing.net + financing.net };
        };

        const currentCF = await getCashFlowForPeriod(startOfMonth, now);
        const closingCash = cashBalance;
        const openingCash = closingCash - currentCF.net;

        return {
          openingCash,
          operating: currentCF.operating,
          investing: currentCF.investing,
          financing: currentCF.financing,
          closingCash,
          netCashFlow: currentCF.net
        };
      })();

      const baseKpis = {
        revenue: {
          value: currentMonthRevenue,
          lastMonth: lastMonthRevenue,
          growth: growthPercent,
          breakdown: revenueBreakdown.map(r => ({ label: r.name, amount: r.currentBalance }))
        },
        cash: {
          value: cashBalance,
          breakdown: cashBreakdown.map(c => ({ label: c.name, amount: c.currentBalance })),
          movement: {
             received: cashFlowData.operating.inflows + cashFlowData.investing.inflows + cashFlowData.financing.inflows,
             paid: cashFlowData.operating.outflows + cashFlowData.investing.outflows + cashFlowData.financing.outflows
          }
        },
        monthlyCashFlow: cashFlowData,
        receivables: {
          value: totalReceivables,
          breakdown: receivablesBreakdown.map(r => ({ label: r.name, amount: r.balance }))
        },
        payables: {
          value: totalPayables,
          breakdown: payablesBreakdown.map(p => ({ label: p.name, amount: p.balance }))
        },
        loans: {
          value: totalLoanOutstanding,
          breakdown: loanBreakdown.map(l => ({ 
            label: l.bankName, 
            principal: l.principalAmount, 
            outstanding: l.outstandingBalance,
            nextEMI: { amount: l.monthlyInstallment, dueDate: l.endDate }
          }))
        },
        netCash: {
          value: netCashPosition,
          breakdown: [
            { label: 'Cash & Bank', amount: cashBalance },
            { label: 'Receivables', amount: totalReceivables },
            { label: 'Payables', amount: -totalPayables },
            { label: 'Loans', amount: -totalLoanOutstanding }
          ]
        },
        currentRatio: {
          value: currentRatio,
          breakdown: [
            { label: 'Current Assets', amount: cashBalance + totalReceivables },
            { label: 'Current Liabilities', amount: totalPayables + totalLoanOutstanding }
          ]
        }
      };

      // 5. Build Charts Data (RMG Optimized)
      const cashFlowTrend: any[] = [];
      const liquidityTrend: any[] = []; 
      const breakdownSeries: any[] = [];

      let cumulativeCash = cashFlowData.openingCash - (await (async () => {
        let sum = 0;
        for(let i=1; i<=5; i++) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const start = new Date(d.getFullYear(), d.getMonth(), 1);
          const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
          const lines = await prisma.journalEntryLine.findMany({
            where: { journalEntry: { companyId, status: 'APPROVED' as any, date: { gte: start, lte: end } }, account: { cashFlowType: { not: null } } }
          });
          sum += lines.reduce((s, l) => s + (Number(l.creditBase) - Number(l.debitBase)), 0);
        }
        return sum;
      })());

      for (let i = 0; i < 6; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const monthName = d.toLocaleString('default', { month: 'short' });
        
        const lines = await prisma.journalEntryLine.findMany({
          where: {
            journalEntry: { companyId, status: 'APPROVED' as any, date: { gte: monthStart, lte: monthEnd } },
            account: { NOT: { cashFlowType: null } }
          },
          include: { account: true }
        });

        let opNet = 0, invNet = 0, finNet = 0;
        for(const l of lines) {
           const val = Number(l.creditBase) - Number(l.debitBase);
           if(l.account.cashFlowType === 'OPERATING') opNet += val;
           else if(l.account.cashFlowType === 'INVESTING') invNet += val;
           else if(l.account.cashFlowType === 'FINANCING') finNet += val;
        }

        const totalNet = opNet + invNet + finNet;
        cashFlowTrend.push({ name: monthName, value: totalNet });
        cumulativeCash += totalNet;
        liquidityTrend.push({ name: monthName, value: cumulativeCash });
        
        breakdownSeries.push({
          name: monthName,
          operating: opNet,
          investing: invNet,
          financing: finNet
        });
      }

      // Daily collection for manager view
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayLines = await prisma.journalEntryLine.findMany({
        where: {
          account: {
            companyId,
            accountType: { name: 'ASSET' },
            OR: [
              { name: { contains: 'Cash', mode: 'insensitive' } },
              { name: { contains: 'Bank', mode: 'insensitive' } }
            ]
          },
          journalEntry: { companyId, status: 'APPROVED', date: { gte: startOfToday } },
          debit: { gt: 0 }
        }
      });
      const dailyCollection = todayLines.reduce((sum: number, l) => sum + Number(l.debitBase), 0);

      let dashboardData: any = {
        role: roleName,
        companyName,
        kpis: {},
        charts: [
          { name: 'Monthly Net Cash Flow', data: cashFlowTrend, type: 'BAR' },
          { name: 'Cash Flow Breakdown', data: breakdownSeries, type: 'STACKED_BAR' },
          { name: 'Liquidity Trend (Cumulative)', data: liquidityTrend, type: 'LINE' },
          { name: 'Revenue by Buyer', data: buyerDistribution, type: 'PIE' }
        ],
        alerts: alerts.slice(0, 10),
        unreadCount,
        lastBackup: lastBackup ? {
          timestamp: lastBackup.createdAt,
          fileName: lastBackup.fileName,
          status: lastBackup.status
        } : null,
        actions: []
      };

      const isAdmin = roleName === 'Admin';
      const isOwner = roleName === 'Owner';
      const isManager = roleName === 'Manager';
      const isAccountant = roleName === 'Accountant';

      if (isOwner || isAdmin) {
        dashboardData.kpis = baseKpis;
        dashboardData.actions = [
          { label: 'View Reports', href: `/company/${companyId}/reports`, icon: 'FileBarChart' },
          { label: 'Owner Profile', href: `/owner/owners`, icon: 'User' },
          { label: 'Manage Finance', href: `/company/${companyId}/finance`, icon: 'Briefcase' },
          { label: 'New Voucher', href: `/company/${companyId}/journals`, icon: 'Plus' }
        ];
      } else if (isManager) {
        dashboardData.kpis = {
          dailyCollection,
          todayPayments: 0,
          pendingVouchers: await prisma.journalEntry.count({ where: { companyId, status: 'PENDING_VERIFICATION' } }),
          cashPosition: cashBalance
        };
        dashboardData.actions = [
          { label: 'Verify Vouchers', href: `/company/${companyId}/journals` },
          { label: 'Cash Flow', href: `/company/${companyId}/reports/cash-flow` }
        ];
      } else if (isAccountant) {
        dashboardData.kpis = {
          pendingVouchers: await prisma.journalEntry.count({ where: { companyId, status: 'DRAFT' } }),
          unpostedEntries: await prisma.journalEntry.count({ where: { companyId, status: 'PENDING_VERIFICATION' } }),
          unreconciledBank: 0
        };
        dashboardData.actions = [
          { label: 'New Journal', href: `/company/${companyId}/journals` },
          { label: 'Bank Rec', href: `/company/${companyId}/bank/reconcile` }
        ];
      } else {
        dashboardData.kpis = { pendingTasks: 4, myEntriesToday: 2 };
        dashboardData.actions = [
          { label: 'Add Entry', href: `/company/${companyId}/journals` }
        ];
      }

      console.log(`[DashboardStats] Assembled data for ${companyId}. Alerts: ${alerts.length}, Unread: ${unreadCount}`);
      return reply.send({ success: true, data: dashboardData });
    } catch (error) {
      console.error(`[DashboardStats] CRITICAL ERROR for ${companyId}:`, error);
      return reply.status(500).send({ success: false, message: 'Internal Server Error while generating dashboard' });
    }
  }
}
