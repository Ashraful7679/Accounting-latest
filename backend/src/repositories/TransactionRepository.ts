import prisma from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';
import { demoInvoices, demoJournals } from '../lib/mockData/transactions';

// In-memory storage for offline demo
let offlineInvoices: any[] = [...demoInvoices];
let offlineJournals: any[] = [...demoJournals];

export class TransactionRepository {
  // --- Invoices ---
  static async findInvoices(where = {}) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.invoice.findMany({
          where,
          include: { 
            customer: true,
            vendor: true,
            createdBy: { select: { firstName: true, lastName: true } },
            verifiedBy: { select: { firstName: true, lastName: true } },
            approvedBy: { select: { firstName: true, lastName: true } },
            lines: true
          },
          orderBy: { createdAt: 'desc' }
        });
      } catch (error) {
        console.error('Invoice search failed, falling back to offline storage');
      }
    }
    const companyId = (where as any).companyId;
    const type = (where as any).type;
    let results = companyId ? offlineInvoices.filter(inv => inv.companyId === companyId) : offlineInvoices;
    if (type) {
      results = results.filter(inv => inv.type === type.toUpperCase());
    }
    return results;
  }

  static async findInvoiceById(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.invoice.findUnique({
          where: { id },
          include: {
            customer: true,
            vendor: true,
            lines: {
              include: { product: true }
            },
            createdBy: { select: { firstName: true, lastName: true } },
            verifiedBy: { select: { firstName: true, lastName: true } },
            approvedBy: { select: { firstName: true, lastName: true } }
          }
        });
      } catch (error) {
        console.error('Invoice retrieval failed, falling back');
      }
    }
    return offlineInvoices.find(inv => inv.id === id);
  }

  static async createInvoice(data: any) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.invoice.create({ data });
      } catch (error) {
        console.error('Invoice creation failed in LIVE mode:', error);
        throw error; // Re-throw to prevent silent failure and offline fallback if unexpected
      }
    }
    
    const newInvoice = { 
      id: `offline-${Date.now()}`, 
      ...data, 
      status: 'DRAFT',
      createdAt: new Date().toISOString() 
    };
    offlineInvoices.unshift(newInvoice);
    return newInvoice;
  }

  // --- Journals ---
  static async findJournals(where = {}, take?: number, skip?: number) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.journalEntry.findMany({
          where,
          take,
          skip,
          include: {
            createdBy: { select: { firstName: true, lastName: true } },
            verifiedBy: { select: { firstName: true, lastName: true } },
            approvedBy: { select: { firstName: true, lastName: true } },
            lines: { include: { account: true } }
          },
          orderBy: { createdAt: 'desc' }
        });
      } catch (error) {
        console.error('Journal search failed, falling back to offline storage');
      }
    }
    const companyId = (where as any).companyId;
    return companyId ? offlineJournals.filter(j => j.companyId === companyId) : offlineJournals;
  }

  static async findJournalById(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.journalEntry.findUnique({
          where: { id },
          include: {
            lines: { include: { account: true } },
            createdBy: { select: { firstName: true, lastName: true } },
            verifiedBy: { select: { firstName: true, lastName: true } },
            approvedBy: { select: { firstName: true, lastName: true } }
          }
        });
      } catch (error) {
        console.error('Journal retrieval failed, falling back');
      }
    }
    return offlineJournals.find(j => j.id === id);
  }

  static async createJournal(data: any) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.journalEntry.create({ 
          data,
          include: { 
            createdBy: { select: { firstName: true, lastName: true } },
            lines: { include: { account: true } }
          }
        });
      } catch (error) {
        console.error('Journal creation failed in LIVE mode:', error);
        console.error('Data attempted:', JSON.stringify(data, null, 2));
        throw error; // Don't fall back to offline if we intended to save to DB
      }
    }
    
    // Normalize for UI: unwrap the 'create' fields if present
    const normalizedLines = data.lines?.create ? data.lines.create : data.lines;

    const newJournal = { 
      id: `offline-${Date.now()}`, 
      ...data, 
      lines: normalizedLines,
      status: data.status || 'DRAFT',
      createdAt: new Date().toISOString(),
      createdBy: { firstName: "Offline", lastName: "User" }
    };
    offlineJournals.unshift(newJournal);
    return newJournal;
  }

  // --- Accounting Hooks ---
  static async generateInvoiceJournal(tx: any, invoice: any, companyId: string, userId: string) {
    const isSales = invoice.type === 'SALES';
    const invoiceTotal = Number(invoice.total);
    const journalDate = new Date(invoice.invoiceDate);

    // 1. Get Primary Accounts
    const revOrExpCategory = isSales ? 'REVENUE' : 'EXPENSE';
    const arOrApCategory = isSales ? 'AR' : 'AP';

    const incomeExpAccount = await tx.account.findFirst({ where: { companyId, category: revOrExpCategory } });
    const arApAccount = await tx.account.findFirst({ where: { companyId, category: arOrApCategory } });

    if (!incomeExpAccount) throw new Error(`${revOrExpCategory} account not found in Chart of Accounts`);
    if (!arApAccount) throw new Error(`${arOrApCategory} account not found in Chart of Accounts`);

    // 2. Handle Split Payments (COD Support)
    const splits = (invoice as any).paymentSplits as {
      cash?: number;
      bank?: number;
      ar?: number;
      ap?: number;
      bankAccountId?: string;
    } | null;

    const cashAmount = Number(splits?.cash || 0);
    const bankAmount = Number(splits?.bank || 0);
    // Remaining goes to AR (for Sales) or AP (for Purchase)
    const creditDebitAmount = Number(isSales ? splits?.ar : splits?.ap) || (invoiceTotal - cashAmount - bankAmount);

    const lines: any[] = [];

    // Cash line
    if (cashAmount > 0) {
      const cashAcc = await tx.account.findFirst({ where: { companyId, category: 'CASH' } });
      if (!cashAcc) throw new Error('Cash account not found');
      lines.push({
        accountId: cashAcc.id,
        debit: isSales ? cashAmount : 0,
        credit: isSales ? 0 : cashAmount,
        debitBase: isSales ? cashAmount : 0,
        creditBase: isSales ? 0 : cashAmount,
        description: `Cash ${isSales ? 'received' : 'paid'} - Inv ${invoice.invoiceNumber}`
      });
      await tx.account.update({ where: { id: cashAcc.id }, data: { currentBalance: { increment: isSales ? cashAmount : -cashAmount } } });
    }

    // Bank line
    if (bankAmount > 0) {
      const bankAcc = splits?.bankAccountId 
        ? await tx.account.findUnique({ where: { id: splits.bankAccountId } })
        : await tx.account.findFirst({ where: { companyId, category: 'BANK' } });
      if (!bankAcc) throw new Error('Bank account not found');
      lines.push({
        accountId: bankAcc.id,
        debit: isSales ? bankAmount : 0,
        credit: isSales ? 0 : bankAmount,
        debitBase: isSales ? bankAmount : 0,
        creditBase: isSales ? 0 : bankAmount,
        description: `Bank ${isSales ? 'received' : 'paid'} - Inv ${invoice.invoiceNumber}`
      });
      await tx.account.update({ where: { id: bankAcc.id }, data: { currentBalance: { increment: isSales ? bankAmount : -bankAmount } } });
    }

    // AR/AP line (Receivable/Payable)
    if (creditDebitAmount > 0) {
      lines.push({
        accountId: arApAccount.id,
        debit: isSales ? creditDebitAmount : 0,
        credit: isSales ? 0 : creditDebitAmount,
        debitBase: isSales ? creditDebitAmount : 0,
        creditBase: isSales ? 0 : creditDebitAmount,
        description: `${isSales ? 'Receivable' : 'Payable'} - Inv ${invoice.invoiceNumber}`
      });
      await tx.account.update({ where: { id: arApAccount.id }, data: { currentBalance: { increment: isSales ? creditDebitAmount : -creditDebitAmount } } });
    }

    // Revenue/Expense line (The Offset)
    lines.push({
      accountId: incomeExpAccount.id,
      debit: isSales ? 0 : invoiceTotal,
      credit: isSales ? invoiceTotal : 0,
      debitBase: isSales ? 0 : invoiceTotal,
      creditBase: isSales ? invoiceTotal : 0,
      description: `${isSales ? 'Revenue' : 'Expense'} - Inv ${invoice.invoiceNumber}`
    });

    // Update income/exp balance
    const isDebitType = (incomeExpAccount as any).accountType?.type === 'DEBIT';
    const balanceChange = isDebitType ? (isSales ? -invoiceTotal : invoiceTotal) : (isSales ? invoiceTotal : -invoiceTotal);
    await tx.account.update({ where: { id: incomeExpAccount.id }, data: { currentBalance: { increment: balanceChange } } });

    // Create the Journal Entry (idempotent: delete old one for this specific invoice and company)
    const entryNumber = `JV-INV-${companyId.slice(0, 8)}-${invoice.invoiceNumber}`;
    const existingJournal = await tx.journalEntry.findFirst({ 
      where: { 
        entryNumber,
        companyId 
      } 
    });
    
    if (existingJournal) {
      // Delete the old journal (lines cascade via Prisma schema)
      await tx.journalEntry.delete({ 
        where: { id: existingJournal.id } 
      });
    }
    
    return await tx.journalEntry.create({
      data: {
        entryNumber,
        companyId,
        date: journalDate,
        description: `Auto-journal: Invoice ${invoice.invoiceNumber}`,
        reference: invoice.invoiceNumber,
        totalDebit: invoiceTotal,
        totalCredit: invoiceTotal,
        status: 'APPROVED',
        createdById: userId,
        approvedById: userId,
        approvedAt: new Date(),
        lines: { create: lines }
      }
    });
  }
}
