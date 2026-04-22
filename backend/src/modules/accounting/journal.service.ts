import prisma from '../../config/database';
import { TransactionRepository } from '../../repositories/TransactionRepository';
import { SequenceService } from '../company/sequence.service';

export class JournalService {
  /**
   * Main entry point for automatic journaling.
   * Processes the accounting impact of a document reaching APPROVED status.
   */
  static async handleDocumentApproval(type: 'INVOICE' | 'BILL' | 'PAYMENT', documentId: string, userId: string): Promise<any> {
    return await prisma.$transaction(async (tx) => {
      switch (type) {
        case 'INVOICE':
          return await this.generateInvoiceJournal(tx, documentId, userId);
        case 'BILL':
          return await this.generateBillJournal(tx, documentId, userId);
        default:
          throw new Error(`Unsupported document type for auto-journaling: ${type}`);
      }
    });
  }

  private static async generateInvoiceJournal(tx: any, invoiceId: string, userId: string) {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true, lines: true }
    });

    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status !== 'APPROVED') throw new Error('Cannot generate journal for unapproved invoice');

    const companyId = invoice.companyId;
    const isSales = invoice.type === 'SALES';
    const totalAmount = Number(invoice.total);
    const exchangeRate = Number(invoice.exchangeRate || 1);
    const totalBase = totalAmount * exchangeRate;

    // 1. Resolve Accounts
    // For Sales: Dr AR (Asset), Cr Revenue
    // For Purchase (if any): Dr Expense, Cr AP (Liability)
    
    const arAccount = await TransactionRepository.ensureEntityAccount(
      tx, 
      companyId, 
      invoice.customerId, 
      invoice.customer.name, 
      invoice.customer.code, 
      'AR'
    );

    const revenueAccount = await tx.account.findFirst({
      where: { companyId, category: 'REVENUE' }
    }) || await this.ensureGenericAccount(tx, companyId, 'REVENUE', 'Sales Revenue');

    const entryNumber = await SequenceService.generateDocumentNumber(companyId, 'journal', tx);

    return await tx.journalEntry.create({
      data: {
        entryNumber,
        companyId,
        date: invoice.date || new Date(),
        description: `Auto-Journal for Invoice ${invoice.invoiceNumber}`,
        status: 'POSTED',
        totalDebit: totalBase,
        totalCredit: totalBase,
        createdById: userId,
        lines: {
          create: [
            {
              accountId: arAccount.id,
              debit: totalBase,
              credit: 0,
              debitBase: totalBase,
              creditBase: 0,
              debitForeign: totalAmount,
              creditForeign: 0,
              exchangeRate,
              customerId: invoice.customerId,
              description: `AR - Inv ${invoice.invoiceNumber}`
            },
            {
              accountId: revenueAccount.id,
              debit: 0,
              credit: totalBase,
              debitBase: 0,
              creditBase: totalBase,
              debitForeign: 0,
              creditForeign: totalAmount,
              exchangeRate,
              description: `Revenue - Inv ${invoice.invoiceNumber}`
            }
          ]
        }
      }
    });
  }

  private static async generateBillJournal(tx: any, billId: string, userId: string) {
    const bill = await tx.bill.findUnique({
      where: { id: billId },
      include: { vendor: true, lines: true }
    });

    if (!bill) throw new Error('Bill not found');
    if (bill.status !== 'APPROVED') throw new Error('Cannot generate journal for unapproved bill');

    const companyId = bill.companyId;
    const totalAmount = Number(bill.total);
    const exchangeRate = Number(bill.exchangeRate || 1);
    const totalBase = totalAmount * exchangeRate;

    // For Bill: Dr Expense, Cr AP (Liability)
    const apAccount = await TransactionRepository.ensureEntityAccount(
      tx, 
      companyId, 
      bill.vendorId, 
      bill.vendor.name, 
      bill.vendor.code, 
      'AP'
    );

    const expenseAccount = await tx.account.findFirst({
      where: { companyId, category: 'EXPENSE' }
    }) || await this.ensureGenericAccount(tx, companyId, 'EXPENSE', 'General Expenses');

    const entryNumber = await SequenceService.generateDocumentNumber(companyId, 'journal', tx);

    return await tx.journalEntry.create({
      data: {
        entryNumber,
        companyId,
        date: bill.date || new Date(),
        description: `Auto-Journal for Bill ${bill.billNumber}`,
        status: 'POSTED',
        totalDebit: totalBase,
        totalCredit: totalBase,
        createdById: userId,
        lines: {
          create: [
            {
              accountId: expenseAccount.id,
              debit: totalBase,
              credit: 0,
              debitBase: totalBase,
              creditBase: 0,
              debitForeign: totalAmount,
              creditForeign: 0,
              exchangeRate,
              description: `Expense - Bill ${bill.billNumber}`
            },
            {
              accountId: apAccount.id,
              debit: 0,
              credit: totalBase,
              debitBase: 0,
              creditBase: totalBase,
              debitForeign: 0,
              creditForeign: totalAmount,
              exchangeRate,
              vendorId: bill.vendorId,
              description: `AP - Bill ${bill.billNumber}`
            }
          ]
        }
      }
    });
  }

  private static async ensureGenericAccount(tx: any, companyId: string, category: string, name: string) {
    const typeName = category === 'REVENUE' ? 'REVENUE' : 'EXPENSE';
    const accountTypeId = await TransactionRepository.getAccountTypeId(typeName);
    
    return await tx.account.create({
      data: {
        code: await SequenceService.generateDocumentNumber(companyId, 'account', tx),
        name,
        companyId,
        accountTypeId,
        category,
        isActive: true
      }
    });
  }
}
