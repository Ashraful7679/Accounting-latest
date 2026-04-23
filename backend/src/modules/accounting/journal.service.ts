import prisma from '../../config/database';
import { TransactionRepository } from '../../repositories/TransactionRepository';
import { SequenceService } from '../company/sequence.service';

export class JournalService {
  /**
   * Main entry point for automatic journaling.
   * IDEMPOTENT: Checks isJournaled flag before processing to prevent duplicate
   * ledger postings during retries or concurrent requests.
   */
  static async handleDocumentApproval(
    type: 'INVOICE' | 'BILL' | 'PAYMENT',
    documentId: string,
    userId: string,
    tx?: any
  ): Promise<any> {
    const process = async (currentTx: any) => {
      // --- IDEMPOTENCY GUARD ---
      if (type === 'INVOICE') {
        const doc = await currentTx.invoice.findUnique({ where: { id: documentId }, select: { isJournaled: true, status: true } });
        if (!doc) throw new Error('Invoice not found');
        if (doc.status !== 'APPROVED') throw new Error('Cannot generate journal for unapproved invoice');
        if (doc.isJournaled) {
          console.warn(`[JournalService] Invoice ${documentId} is already journaled. Skipping.`);
          return { alreadyJournaled: true };
        }
      } else if (type === 'BILL') {
        const doc = await currentTx.bill.findUnique({ where: { id: documentId }, select: { isJournaled: true, status: true } });
        if (!doc) throw new Error('Bill not found');
        if (doc.status !== 'APPROVED') throw new Error('Cannot generate journal for unapproved bill');
        if (doc.isJournaled) {
          console.warn(`[JournalService] Bill ${documentId} is already journaled. Skipping.`);
          return { alreadyJournaled: true };
        }
      }

      // --- PROCESS JOURNAL ---
      switch (type) {
        case 'INVOICE':
          return await this.generateInvoiceJournal(currentTx, documentId, userId);
        case 'BILL':
          return await this.generateBillJournal(currentTx, documentId, userId);
        default:
          throw new Error(`Unsupported document type for auto-journaling: ${type}`);
      }
    };

    if (tx) {
      return await process(tx);
    } else {
      return await prisma.$transaction(async (newTx) => await process(newTx));
    }
  }

  private static async generateInvoiceJournal(tx: any, invoiceId: string, userId: string) {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true, lines: true }
    });

    if (!invoice) throw new Error('Invoice not found');

    const companyId = invoice.companyId;
    const totalAmount = Number(invoice.total);
    const exchangeRate = Number(invoice.exchangeRate || 1);
    const totalBase = totalAmount * exchangeRate;

    // Resolve AR and Revenue accounts
    const arAccount = await TransactionRepository.ensureEntityAccount(
      tx,
      companyId,
      invoice.customerId,
      invoice.customer?.name || 'Accounts Receivable',
      invoice.customer?.code || 'AR',
      'AR'
    );

    const revenueAccount = await tx.account.findFirst({
      where: { companyId, category: 'REVENUE', deletedAt: null }
    }) || await this.ensureGenericAccount(tx, companyId, 'REVENUE', 'Sales Revenue');

    const entryNumber = await SequenceService.generateDocumentNumber(companyId, 'journal', tx);

    // Create the journal entry
    const journal = await tx.journalEntry.create({
      data: {
        entryNumber,
        companyId,
        date: invoice.invoiceDate || new Date(),
        description: `Auto-Journal: Invoice ${invoice.invoiceNumber}`,
        reference: invoice.invoiceNumber,
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

    // IDEMPOTENCY LOCK: Mark the invoice as journaled in the same transaction
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        isJournaled: true,
        journalId: journal.id
      }
    });

    return journal;
  }

  private static async generateBillJournal(tx: any, billId: string, userId: string) {
    const bill = await tx.bill.findUnique({
      where: { id: billId },
      include: { vendor: true }
    });

    if (!bill) throw new Error('Bill not found');

    const companyId = bill.companyId;
    const totalAmount = Number(bill.total);
    const exchangeRate = Number((bill as any).exchangeRate || 1);
    const totalBase = totalAmount * exchangeRate;

    // Resolve AP and Expense accounts
    const apAccount = await TransactionRepository.ensureEntityAccount(
      tx,
      companyId,
      bill.vendorId,
      bill.vendor?.name || 'Accounts Payable',
      bill.vendor?.code || 'AP',
      'AP'
    );

    const expenseAccount = await tx.account.findFirst({
      where: { companyId, category: 'EXPENSE', deletedAt: null }
    }) || await this.ensureGenericAccount(tx, companyId, 'EXPENSE', 'General Expenses');

    const entryNumber = await SequenceService.generateDocumentNumber(companyId, 'journal', tx);

    // Create the journal entry
    const journal = await tx.journalEntry.create({
      data: {
        entryNumber,
        companyId,
        date: (bill as any).date || new Date(),
        description: `Auto-Journal: Bill ${bill.billNumber}`,
        reference: bill.billNumber,
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

    // IDEMPOTENCY LOCK: Mark the bill as journaled in the same transaction
    await tx.bill.update({
      where: { id: billId },
      data: {
        isJournaled: true,
        journalId: journal.id
      }
    });

    return journal;
  }

  private static async ensureGenericAccount(tx: any, companyId: string, category: string, name: string) {
    const typeName = category === 'REVENUE' ? 'REVENUE' : 'EXPENSE';
    const accountType = await tx.accountType.findFirst({ where: { name: typeName } });
    if (!accountType) throw new Error(`Account type '${typeName}' not found in Chart of Accounts`);

    return await tx.account.create({
      data: {
        code: await SequenceService.generateDocumentNumber(companyId, 'account', tx),
        name,
        companyId,
        accountTypeId: accountType.id,
        category,
        isActive: true
      }
    });
  }
}
