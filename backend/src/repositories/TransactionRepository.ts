import prisma from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';
import { demoInvoices, demoJournals } from '../lib/mockData/transactions';
import { SequenceService } from '../modules/company/sequence.service';

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



  static async updateStockFromLines(tx: any, lines: any[], multiplier: number) {
    for (const line of lines) {
      if (line.productId) {
        await tx.product.update({
          where: { id: line.productId },
          data: {
            stockAmount: {
              increment: Number(line.quantity || 0) * multiplier
            }
          }
        });
      }
    }
  }

  // --- Payment Hooks ---
  static async generatePaymentJournal(tx: any, payment: any, companyId: string, userId: string, type: 'SALES' | 'PURCHASE' | 'LC_EXPORT' | 'LC_IMPORT') {
    const amount = Number(payment.amount);
    const isInward = type === 'SALES' || type === 'LC_EXPORT';
    const arApCategory = isInward ? 'AR' : 'AP';
    const arApAccount = await tx.account.findFirst({ where: { companyId, category: arApCategory } });

    if (!arApAccount) throw new Error(`${arApCategory} account not found`);
    if (!payment.accountId) throw new Error('Settlement account (Bank/Cash) not found on payment');

    const entryNumber = `JV-PMT-${payment.id.substring(0, 8)}`;
    const journalDesc = isInward 
      ? `Payment Received - Ref: ${payment.paymentNumber}`
      : `Payment Made - Ref: ${payment.paymentNumber}`;

    // Cleanup existing for idempotency
    const existing = await tx.journalEntry.findFirst({ where: { entryNumber, companyId } });
    if (existing) await tx.journalEntry.delete({ where: { id: existing.id } });

    // Update Balances
    const settlementAccFull = await tx.account.findUnique({ where: { id: payment.accountId }, include: { accountType: true } });
    const arApAccFull = await tx.account.findUnique({ where: { id: arApAccount.id }, include: { accountType: true } });

    // Settlement Account (Bank/Cash)
    // If Inward (Receiving): Debit increase. If Debit-type account -> increment by amount.
    // If Outward (Paying): Credit increase. If Debit-type account -> decrement by amount.
    const settlementChange = isInward 
      ? (settlementAccFull.accountType.type === 'DEBIT' ? amount : -amount)
      : (settlementAccFull.accountType.type === 'DEBIT' ? -amount : amount);

    // AR/AP Account
    // If Inward (AR Settlement): Credit increase. If Debit-type account -> decrement by amount.
    // If Outward (AP Settlement): Debit increase. If Credit-type account -> decrement by amount.
    const contraChange = isInward
      ? (arApAccFull.accountType.type === 'DEBIT' ? -amount : amount)
      : (arApAccFull.accountType.type === 'CREDIT' ? -amount : amount);

    await tx.account.update({ where: { id: payment.accountId }, data: { currentBalance: { increment: settlementChange } } });
    await tx.account.update({ where: { id: arApAccount.id }, data: { currentBalance: { increment: contraChange } } });

    return await tx.journalEntry.create({
      data: {
        entryNumber,
        companyId,
        date: new Date(payment.date),
        description: journalDesc,
        reference: payment.paymentNumber,
        totalDebit: amount,
        totalCredit: amount,
        status: 'APPROVED',
        createdById: userId,
        approvedById: userId,
        approvedAt: new Date(),
        lines: {
          create: [
            { 
              accountId: payment.accountId, 
              debit: isInward ? amount : 0, 
              credit: isInward ? 0 : amount, 
              debitBase: isInward ? amount : 0, 
              creditBase: isInward ? 0 : amount,
              description: `Cash/Bank - ${journalDesc}`
            },
            { 
              accountId: arApAccount.id, 
              debit: isInward ? 0 : amount, 
              credit: isInward ? amount : 0, 
              debitBase: isInward ? 0 : amount, 
              creditBase: isInward ? amount : 0,
              description: `${arApCategory} Settlement - ${journalDesc}`
            },
          ],
        },
      },
    });
  }

  // --- Transfer Hooks ---
  static async generateTransferJournal(tx: any, transfer: any, companyId: string, userId: string, toAccountId: string) {
    const amount = Number(transfer.amount);
    const entryNumber = `JV-TRF-${transfer.id.substring(0, 8)}`;

    const existing = await tx.journalEntry.findFirst({ where: { entryNumber, companyId } });
    if (existing) await tx.journalEntry.delete({ where: { id: existing.id } });

    // Update balances
    const toAcc = await tx.account.findUnique({ where: { id: toAccountId }, include: { accountType: true } });
    const fromAcc = await tx.account.findUnique({ where: { id: transfer.accountId }, include: { accountType: true } });

    const toChange = toAcc.accountType.type === 'DEBIT' ? amount : -amount;
    const fromChange = fromAcc.accountType.type === 'DEBIT' ? -amount : amount;

    await tx.account.update({ where: { id: toAccountId }, data: { currentBalance: { increment: toChange } } });
    await tx.account.update({ where: { id: transfer.accountId }, data: { currentBalance: { increment: fromChange } } });

    return await tx.journalEntry.create({
      data: {
        entryNumber,
        companyId,
        date: new Date(transfer.date),
        description: `Bank Transfer: ${transfer.description || transfer.paymentNumber}`,
        reference: transfer.paymentNumber,
        totalDebit: amount,
        totalCredit: amount,
        status: 'APPROVED',
        createdById: userId,
        approvedById: userId,
        approvedAt: new Date(),
        lines: {
          create: [
            { accountId: toAccountId, debit: amount, credit: 0, debitBase: amount, creditBase: 0, description: `Transfer In - ${transfer.paymentNumber}` },
            { accountId: transfer.accountId, debit: 0, credit: amount, debitBase: 0, creditBase: amount, description: `Transfer Out - ${transfer.paymentNumber}` },
          ],
        },
      },
    });
  }

  // --- Automated Account Creation ---

  static async getAccountTypeId(typeName: string) {
    const type = await prisma.accountType.findUnique({ where: { name: typeName.toUpperCase() } });
    if (!type) throw new Error(`Account type ${typeName} not found`);
    return type.id;
  }

  /**
   * Ensures a dedicated ledger account exists for a Customer, Vendor, or Employee.
   * Scoped to the company.
   */
  static async ensureEntityAccount(tx: any, companyId: string, entityId: string, entityName: string, entityCode: string, category: 'AR' | 'AP' | 'PAYABLE', openingBalance: number = 0) {
    // Check if an account already exists for this entity (by entityCode in name)
    const existing = await tx.account.findFirst({
      where: { companyId, name: { contains: entityCode, mode: 'insensitive' } }
    });
    if (existing) return existing;

    const typeName = category === 'AR' ? 'ASSET' : 'LIABILITY';
    const accountTypeId = await this.getAccountTypeId(typeName);

    // Automation: Find or Create Parent Account for better organization (like the bank)
    let parentId: string | null = null;
    const parentName = category === 'AR' ? 'Accounts Receivable' : category === 'AP' ? 'Accounts Payable' : 'Employee Payables & Salaries';
    const parentCategory = category === 'AR' ? 'AR_PARENT' : category === 'AP' ? 'AP_PARENT' : 'PAYABLE_PARENT';

    let parentAcc = await tx.account.findFirst({
      where: { companyId, category: parentCategory }
    });

    if (!parentAcc) {
      // Create a logical parent if it doesn't exist
      const parentCode = category === 'AR' ? '1200' : category === 'AP' ? '2100' : '2200';
      parentAcc = await tx.account.create({
        data: {
          code: `${parentCode}-BASE`,
          name: parentName,
          companyId,
          accountTypeId,
          category: parentCategory,
          isActive: true
        }
      });
    }
    parentId = parentAcc.id;

    // Generate a unique account code
    const prefix = category === 'AR' ? 'ACC-AR' : category === 'AP' ? 'ACC-AP' : 'ACC-PAY';
    const year = new Date().getFullYear();
    const prefixYear = `${prefix}-${year}-`;

    const countResult = await tx.account.count({
      where: { companyId, code: { startsWith: prefixYear } }
    });

    let counter = countResult + 1;
    let code = '';
    let attempts = 0;
    while (true) {
      const candidate = `${prefixYear}${counter.toString().padStart(4, '0')}`;
      const codeExists = await tx.account.findUnique({ where: { companyId_code: { companyId, code: candidate } } });
      if (!codeExists) { code = candidate; break; }
      counter++;
      if (++attempts > 200) throw new Error(`Cannot generate unique account code for category "${category}" after 200 attempts`);
    }

    return await tx.account.create({
      data: {
        code,
        name: `${entityCode} - ${entityName}`,
        companyId,
        accountTypeId,
        parentId,
        category,
        openingBalance: Number(openingBalance),
        currentBalance: Number(openingBalance),
        isActive: true,
        referenceId: entityId,
      }
    });
  }

  // --- Salary Workflows ---

  /**
   * Generates a DRAFT journal entry for a salary payment request.
   */
  static async generateSalaryJournal(tx: any, { companyId, employeeId, amount, date, description, userId }: any) {
    const employee = await tx.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new Error('Employee not found');

    // 1. Ensure Employee has a specific Payable Account
    const employeeAccount = await this.ensureEntityAccount(tx, companyId, employeeId, `${employee.firstName} ${employee.lastName}`, employee.employeeCode, 'PAYABLE');

    // 2. Find/Create "Salaries Expense" Account
    let salaryExpenseAccount = await tx.account.findFirst({
      where: { companyId, category: 'EXPENSE', name: { contains: 'Salary', mode: 'insensitive' } }
    });

    if (!salaryExpenseAccount) {
      const expenseTypeId = await this.getAccountTypeId('EXPENSE');
      salaryExpenseAccount = await tx.account.create({
        data: {
          code: await SequenceService.generateDocumentNumber(companyId, 'product', tx), // PRD used as fallback for generic accounts
          name: 'Salaries & Wages Expense',
          companyId,
          accountTypeId: expenseTypeId,
          category: 'EXPENSE',
          isActive: true
        }
      });
    }

    const entryNumber = `SAL-${employee.employeeCode}-${Date.now().toString().substring(8)}`;

    return await tx.journalEntry.create({
      data: {
        entryNumber,
        companyId,
        date: new Date(date),
        description: description || `Salary Payment Draft for ${employee.firstName} ${employee.lastName}`,
        totalDebit: Number(amount),
        totalCredit: Number(amount),
        status: 'DRAFT',
        createdById: userId,
        lines: {
          create: [
            { 
              accountId: salaryExpenseAccount.id, 
              debit: Number(amount), 
              credit: 0, 
              debitBase: Number(amount), 
              creditBase: 0, 
              description: `Salary Expense - ${employee.firstName}` 
            },
            { 
              accountId: employeeAccount.id, 
              debit: 0, 
              credit: Number(amount), 
              debitBase: 0, 
              creditBase: Number(amount), 
              description: `Salary Payable - ${employee.firstName}` 
            },
          ],
        },
      },
    });
  }
}
