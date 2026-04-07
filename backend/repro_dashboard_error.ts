
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
          message: `Invoice ${inv.invoiceNumber} is ${daysOverdue} day(s) overdue. Amount: \u09F3${Number(inv.total).toLocaleString()}.`,
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
          message: `LC ${lc.lcNumber} expires in ${daysLeft} day(s). Value: ${Number(lc.amount).toLocaleString()} ${lc.currency} (\u09F3${Number(lc.amount * convRate).toLocaleString()}).`,
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
          message: `Loan ${loan.loanNumber} matures in ${daysLeft} day(s). Outstanding: \u09F3${Number(loan.outstandingBalance).toLocaleString()}.`,
          entityType: 'Loan', entityId: loan.id,
        },
      });
    }
  }
}

async function repro(userId: string, companyId: string) {
    console.log(`[Repro] Fetching for User: ${userId}, Company: ${companyId}`);

    // 1. Get User's Role & Access in this Company
    let userCompany = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
      include: {
        user: { include: { userRoles: { include: { role: true } } } },
        company: true
      }
    });

    if (!userCompany) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { userRoles: { include: { role: true } } }
      });
      const isAdmin = user?.userRoles.some(ur => ur.role.name === 'Admin');
      if (isAdmin) {
        const company = await prisma.company.findUnique({ where: { id: companyId } });
        userCompany = {
          userId,
          companyId,
          user,
          company,
          isMainOwner: true, 
          ownershipPercentage: 0,
        } as any;
      } else {
        throw new Error('Access denied');
      }
    }

    const roleName = userCompany!.user.userRoles[0]?.role?.name || 'User';
    console.log(`[Repro] User Role: ${roleName}`);

    // 2. Auto-generate real notifications from DB events
    await generateNotifications(companyId);

    // 3. Fetch Base Financial Stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const getRevenue = async (from?: Date, to?: Date) => {
        const where: any = {
          journalEntry: {
            companyId,
            status: 'APPROVED',
          },
          account: {
            OR: [
              { accountType: { name: 'INCOME' } },
              { accountType: { name: 'REVENUE' } },
              { category: 'REVENUE' }
            ]
          }
        };
        if (from || to) {
          where.journalEntry.date = {};
          if (from) where.journalEntry.date.gte = from;
          if (to) where.journalEntry.date.lte = to;
        }

        const lines = await prisma.journalEntryLine.findMany({ where });
        return lines.reduce((sum: number, l: any) => sum + (Number(l.creditBase) - Number(l.debitBase)), 0);
    };

    const totalRevenue = await getRevenue();
    const currentMonthRevenue = await getRevenue(startOfMonth);
    const lastMonthRevenue = await getRevenue(startOfLastMonth, endOfLastMonth);

    let growthPercent = 0;
    if (lastMonthRevenue > 0) {
      growthPercent = ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
    } else if (currentMonthRevenue > 0) {
      growthPercent = 100;
    }

    const cashBankAccounts = await prisma.account.findMany({
      where: {
        companyId,
        OR: [
          { category: 'CASH' },
          { category: 'BANK' }
        ]
      }
    });
    
    const allCashBankIds = cashBankAccounts.map((a: any) => a.id);
    
    let cashBalance = 0;
    if (allCashBankIds.length > 0) {
      const cashLines = await prisma.journalEntryLine.findMany({
        where: {
          journalEntry: { companyId, status: 'APPROVED' },
          accountId: { in: allCashBankIds }
        }
      });
      cashBalance = cashLines.reduce((sum: number, l: any) => sum + (Number(l.debitBase) - Number(l.creditBase)), 0);
    }

    const recLines = await prisma.journalEntryLine.findMany({
      where: {
        journalEntry: { companyId, status: 'APPROVED' },
        account: {
          accountType: { name: 'ASSET' },
          name: { contains: 'Receivable', mode: 'insensitive' }
        }
      }
    });
    const totalReceivables = recLines.reduce((sum: number, l: any) => sum + (Number(l.debitBase) - Number(l.creditBase)), 0);

    const payLines = await prisma.journalEntryLine.findMany({
      where: {
        journalEntry: { companyId, status: 'APPROVED' },
        account: {
          accountType: { name: 'LIABILITY' },
          name: { contains: 'Payable', mode: 'insensitive' }
        }
      }
    });
    const totalPayables = payLines.reduce((sum: number, l: any) => sum + (Number(l.creditBase) - Number(l.debitBase)), 0);

    const loanLines = await prisma.journalEntryLine.findMany({
      where: {
        journalEntry: { companyId, status: 'APPROVED' },
        account: {
          accountType: { name: 'LIABILITY' },
          name: { contains: 'Loan', mode: 'insensitive' }
        }
      }
    });
    const totalLoanOutstanding = loanLines.reduce((sum: number, l: any) => sum + (Number(l.creditBase) - Number(l.debitBase)), 0);

    const netCashPosition = cashBalance + totalReceivables - totalPayables - totalLoanOutstanding;

    // --- NEW: Full Accounting Equation (Lifetime) ---
    const allAssetLines = await prisma.journalEntryLine.findMany({
      where: { journalEntry: { companyId, status: 'APPROVED' }, account: { accountType: { name: 'ASSET' } } }
    });
    const totalAssets = allAssetLines.reduce((sum, l) => sum + (Number(l.debitBase) - Number(l.creditBase)), 0);

    const allLiabilityLines = await prisma.journalEntryLine.findMany({
      where: { journalEntry: { companyId, status: 'APPROVED' }, account: { accountType: { name: 'LIABILITY' } } }
    });
    const totalLiabilities = allLiabilityLines.reduce((sum, l) => sum + (Number(l.creditBase) - Number(l.debitBase)), 0);

    const allEquityLines = await prisma.journalEntryLine.findMany({
      where: { journalEntry: { companyId, status: 'APPROVED' }, account: { accountType: { name: 'EQUITY' } } }
    });
    const totalEquity = allEquityLines.reduce((sum, l) => sum + (Number(l.creditBase) - Number(l.debitBase)), 0);

    const allExpenseLines = await prisma.journalEntryLine.findMany({
      where: { journalEntry: { companyId, status: 'APPROVED' }, account: { accountType: { name: 'EXPENSE' } } }
    });
    const totalExpensesOverview = allExpenseLines.reduce((sum, l) => sum + (Number(l.debitBase) - Number(l.creditBase)), 0);

    console.log('Accounting Equation:', { totalAssets, totalLiabilities, totalEquity, totalRevenue, totalExpensesOverview });

    // Buyer Distribution
    const buyers = await prisma.customer.findMany({
      where: { companyId, isActive: true },
      include: {
        journalLines: {
          where: {
            journalEntry: { status: 'APPROVED', date: { gte: startOfMonth } },
            account: { 
              OR: [
                { accountType: { name: 'INCOME' } },
                { accountType: { name: 'REVENUE' } }
              ]
            }
          }
        }
      }
    });
    const buyerDistribution = buyers.map((b: any) => ({
      name: b.name,
      value: Math.abs(b.journalLines.reduce((sum: number, l: any) => sum + (Number(l.creditBase) - Number(l.debitBase)), 0))
    }));

    console.log('Buyer Distribution Done');

    // Revenue vs Expense Trend
    for (let i = 0; i < 6; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        
        await prisma.journalEntryLine.aggregate({
          where: {
            journalEntry: { companyId, status: 'APPROVED', date: { gte: monthStart, lte: monthEnd } },
            account: { 
              OR: [
                { accountType: { name: 'INCOME' } },
                { accountType: { name: 'REVENUE' } }
              ]
            }
          },
          _sum: { creditBase: true, debitBase: true }
        });
    }

    console.log('Trend Done');

    console.log('SUCCESS');
}

const companyId = '235280c2-f037-4249-8696-bc38738a190e';
const userId = 'e16db93a-9997-4fc7-8160-99235f20f991';

repro(userId, companyId).catch(err => {
    console.error('REPRO FAILED:', err);
    process.exit(1);
});

