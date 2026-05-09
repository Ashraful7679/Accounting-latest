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
    type: 'INVOICE' | 'BILL' | 'PAYMENT' | 'DN' | 'GRN',
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
      } else if (type === 'DN') {
        const doc = await currentTx.dN.findUnique({ where: { id: documentId }, select: { isJournaled: true, status: true } });
        if (!doc) throw new Error('Delivery Note not found');
        if (doc.isJournaled) return { alreadyJournaled: true };
      } else if (type === 'GRN') {
        const doc = await currentTx.gRN.findUnique({ where: { id: documentId }, select: { isJournaled: true, status: true } });
        if (!doc) throw new Error('GRN not found');
        if (doc.isJournaled) return { alreadyJournaled: true };
      }

      // --- PROCESS JOURNAL ---
      switch (type) {
        case 'INVOICE':
          return await this.generateInvoiceJournal(currentTx, documentId, userId);
        case 'BILL':
          return await this.generateBillJournal(currentTx, documentId, userId);
        case 'DN':
          return await this.generateDNJournal(currentTx, documentId, userId);
        case 'GRN':
          return await this.generateGRNJournal(currentTx, documentId, userId);
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
      include: { customer: true, vendor: true, lines: true }
    });

    if (!invoice) throw new Error('Invoice not found');

    const companyId = invoice.companyId;
    const totalAmount = Number(invoice.total);
    const exchangeRate = Number(invoice.exchangeRate || 1);
    const totalBase = totalAmount * exchangeRate;

    // Resolve AR/AP Accounts
    const entityAccount = await TransactionRepository.ensureEntityAccount(
      tx,
      companyId,
      invoice.type === 'PURCHASE' ? invoice.vendorId : invoice.customerId,
      (invoice.type === 'PURCHASE' ? invoice.vendor?.name : invoice.customer?.name) || (invoice.type === 'PURCHASE' ? 'Accounts Payable' : 'Accounts Receivable'),
      (invoice.type === 'PURCHASE' ? invoice.vendor?.code : invoice.customer?.code) || (invoice.type === 'PURCHASE' ? 'AP' : 'AR'),
      invoice.type === 'PURCHASE' ? 'AP' : 'AR'
    );

    // Resolve Control Accounts
    const revenueAccount = await tx.account.findFirst({
      where: { companyId, category: 'REVENUE', deletedAt: null }
    }) || await this.ensureGenericAccount(tx, companyId, 'REVENUE', 'Sales Revenue');

    const inventoryAccount = await tx.account.findFirst({
      where: { companyId, category: 'INVENTORY', deletedAt: null }
    }) || await this.ensureGenericAccount(tx, companyId, 'INVENTORY', 'Inventory Stock');

    const vatAccount = await tx.account.findFirst({
      where: { companyId, category: 'TAX', deletedAt: null }
    }) || await this.ensureGenericAccount(tx, companyId, 'TAX', 'VAT Control');

    // Unbilled Control Accounts
    const unbilledARAccount = await tx.account.findFirst({
      where: { companyId, category: 'AR_UNBILLED', deletedAt: null }
    }) || await this.ensureGenericAccount(tx, companyId, 'AR_UNBILLED', 'Accounts Receivable (Unbilled)');

    const unbilledAPAccount = await tx.account.findFirst({
      where: { companyId, category: 'AP_UNBILLED', deletedAt: null }
    }) || await this.ensureGenericAccount(tx, companyId, 'AP_UNBILLED', 'Accounts Payable (Unbilled)');

    const entryNumber = await SequenceService.generateDocumentNumber(companyId, 'journal', tx);

    const subtotalBase = Number(invoice.subtotal || 0) * exchangeRate;
    const taxBase = Number(invoice.taxAmount || 0) * exchangeRate;

    const lines = [];

    // Check if linked to DN or GRN (to adjust unbilled accounts)
    const hasDN = (invoice as any).dns && (invoice as any).dns.length > 0;
    const hasGRN = (invoice as any).grns && (invoice as any).grns.length > 0;

    if (invoice.type === 'PURCHASE') {
      if (hasGRN) {
        // Dr Unbilled AP (instead of Inventory, since GRN already hit Inventory/AP_Unbilled)
        lines.push({
          accountId: unbilledAPAccount.id,
          debit: subtotalBase, credit: 0,
          debitBase: subtotalBase, creditBase: 0,
          debitForeign: Number(invoice.subtotal || 0), creditForeign: 0,
          exchangeRate,
          description: `GRN Adjustment - Inv ${invoice.invoiceNumber}`
        });
      } else {
        // Dr Inventory (Subtotal)
        lines.push({
          accountId: inventoryAccount.id,
          debit: subtotalBase, credit: 0,
          debitBase: subtotalBase, creditBase: 0,
          debitForeign: Number(invoice.subtotal || 0), creditForeign: 0,
          exchangeRate,
          description: `Inventory - Inv ${invoice.invoiceNumber}`
        });
      }
      
      // Dr VAT (Tax)
      if (taxBase > 0) {
        lines.push({
          accountId: vatAccount.id,
          debit: taxBase, credit: 0,
          debitBase: taxBase, creditBase: 0,
          debitForeign: Number(invoice.taxAmount || 0), creditForeign: 0,
          exchangeRate,
          description: `VAT In - Inv ${invoice.invoiceNumber}`
        });
      }
      // Cr AP (Total)
      lines.push({
        accountId: entityAccount.id,
        debit: 0, credit: totalBase,
        debitBase: 0, creditBase: totalBase,
        debitForeign: 0, creditForeign: totalAmount,
        exchangeRate,
        vendorId: invoice.vendorId,
        description: `AP - Inv ${invoice.invoiceNumber}`
      });
    } else {
      // SALES
      // Dr AR (Total)
      lines.push({
        accountId: entityAccount.id,
        debit: totalBase, credit: 0,
        debitBase: totalBase, creditBase: 0,
        debitForeign: totalAmount, creditForeign: 0,
        exchangeRate,
        customerId: invoice.customerId,
        description: `AR - Inv ${invoice.invoiceNumber}`
      });

      if (hasDN) {
        // Cr Unbilled AR (instead of Revenue, since DN already hit AR_Unbilled/Revenue)
        lines.push({
          accountId: unbilledARAccount.id,
          debit: 0, credit: subtotalBase,
          debitBase: 0, creditBase: subtotalBase,
          debitForeign: 0, creditForeign: Number(invoice.subtotal || 0),
          exchangeRate,
          description: `DN Adjustment - Inv ${invoice.invoiceNumber}`
        });
      } else {
        // Cr Revenue (Subtotal)
        lines.push({
          accountId: revenueAccount.id,
          debit: 0, credit: subtotalBase,
          debitBase: 0, creditBase: subtotalBase,
          debitForeign: 0, creditForeign: Number(invoice.subtotal || 0),
          exchangeRate,
          description: `Revenue - Inv ${invoice.invoiceNumber}`
        });
      }

      // Cr VAT (Tax)
      if (taxBase > 0) {
        lines.push({
          accountId: vatAccount.id,
          debit: 0, credit: taxBase,
          debitBase: 0, creditBase: taxBase,
          debitForeign: 0, creditForeign: Number(invoice.taxAmount || 0),
          exchangeRate,
          description: `VAT Out - Inv ${invoice.invoiceNumber}`
        });
      }
    }

    // Create the journal entry
    const journal = await tx.journalEntry.create({
      data: {
        entryNumber,
        companyId,
        date: invoice.invoiceDate || new Date(),
        description: `Auto-Journal: ${invoice.type} Invoice ${invoice.invoiceNumber}`,
        reference: invoice.invoiceNumber,
        status: 'POSTED',
        totalDebit: totalBase,
        totalCredit: totalBase,
        createdById: userId,
        branchId: (invoice as any).branchId,
        lines: { create: lines }
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
        branchId: (bill as any).branchId,
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

  private static async generateDNJournal(tx: any, dnId: string, userId: string) {
    const dn = await tx.dN.findUnique({
      where: { id: dnId },
      include: { salesOrder: { include: { customer: true } }, lines: { include: { product: true } } }
    });

    if (!dn) throw new Error('DN not found');

    const companyId = dn.companyId;
    const exchangeRate = Number(dn.salesOrder?.exchangeRate || 1);
    const entryNumber = await SequenceService.generateDocumentNumber(companyId, 'journal', tx);

    // Calculate Subtotal from lines
    const subtotalForeign = dn.lines.reduce((sum: number, l: any) => {
      const soLine = dn.salesOrder?.lines?.find((sol: any) => sol.productId === l.productId);
      return sum + (Number(l.quantity) * Number(soLine?.unitPrice || l.product?.unitPrice || 0));
    }, 0);
    const subtotalBase = subtotalForeign * exchangeRate;

    // Resolve Accounts
    const unbilledARAccount = await tx.account.findFirst({
      where: { companyId, category: 'AR_UNBILLED', deletedAt: null }
    }) || await this.ensureGenericAccount(tx, companyId, 'AR_UNBILLED', 'Accounts Receivable (Unbilled)');

    const revenueAccount = await tx.account.findFirst({
      where: { companyId, category: 'REVENUE', deletedAt: null }
    }) || await this.ensureGenericAccount(tx, companyId, 'REVENUE', 'Sales Revenue');

    const journal = await tx.journalEntry.create({
      data: {
        entryNumber,
        companyId,
        date: dn.shipmentDate || new Date(),
        description: `Delivery Note Journal: ${dn.dnNumber}`,
        reference: dn.dnNumber,
        status: 'POSTED',
        totalDebit: subtotalBase,
        totalCredit: subtotalBase,
        createdById: userId,
        branchId: (dn as any).branchId,
        lines: {
          create: [
            {
              accountId: unbilledARAccount.id,
              debit: subtotalBase, credit: 0,
              debitBase: subtotalBase, creditBase: 0,
              debitForeign: subtotalForeign, creditForeign: 0,
              exchangeRate,
              customerId: dn.salesOrder?.customerId,
              description: `Unbilled AR - DN ${dn.dnNumber}`
            },
            {
              accountId: revenueAccount.id,
              debit: 0, credit: subtotalBase,
              debitBase: 0, creditBase: subtotalBase,
              debitForeign: 0, creditForeign: subtotalForeign,
              exchangeRate,
              description: `Revenue - DN ${dn.dnNumber}`
            }
          ]
        }
      }
    });

    await tx.dN.update({
      where: { id: dnId },
      data: { isJournaled: true, journalId: journal.id }
    });

    return journal;
  }

  private static async generateGRNJournal(tx: any, grnId: string, userId: string) {
    const grn = await tx.gRN.findUnique({
      where: { id: grnId },
      include: { purchaseOrder: { include: { supplier: true } }, lines: { include: { product: true } } }
    });

    if (!grn) throw new Error('GRN not found');

    const companyId = grn.companyId;
    const exchangeRate = Number(grn.purchaseOrder?.exchangeRate || 1);
    const entryNumber = await SequenceService.generateDocumentNumber(companyId, 'journal', tx);

    const subtotalForeign = grn.lines.reduce((sum: number, l: any) => {
      const poLine = grn.purchaseOrder?.lines?.find((pol: any) => pol.productId === l.productId);
      return sum + (Number(l.quantity) * Number(poLine?.unitPrice || l.product?.unitPrice || 0));
    }, 0);
    const subtotalBase = subtotalForeign * exchangeRate;

    const unbilledAPAccount = await tx.account.findFirst({
      where: { companyId, category: 'AP_UNBILLED', deletedAt: null }
    }) || await this.ensureGenericAccount(tx, companyId, 'AP_UNBILLED', 'Accounts Payable (Unbilled)');

    const inventoryAccount = await tx.account.findFirst({
      where: { companyId, category: 'INVENTORY', deletedAt: null }
    }) || await this.ensureGenericAccount(tx, companyId, 'INVENTORY', 'Inventory Stock');

    const journal = await tx.journalEntry.create({
      data: {
        entryNumber,
        companyId,
        date: grn.receivedDate || new Date(),
        description: `GRN Journal: ${grn.grnNumber}`,
        reference: grn.grnNumber,
        status: 'POSTED',
        totalDebit: subtotalBase,
        totalCredit: subtotalBase,
        createdById: userId,
        branchId: (grn as any).branchId,
        lines: {
          create: [
            {
              accountId: inventoryAccount.id,
              debit: subtotalBase, credit: 0,
              debitBase: subtotalBase, creditBase: 0,
              debitForeign: subtotalForeign, creditForeign: 0,
              exchangeRate,
              description: `Inventory - GRN ${grn.grnNumber}`
            },
            {
              accountId: unbilledAPAccount.id,
              debit: 0, credit: subtotalBase,
              debitBase: 0, creditBase: subtotalBase,
              debitForeign: 0, creditForeign: subtotalForeign,
              exchangeRate,
              vendorId: grn.purchaseOrder?.supplierId,
              description: `Unbilled AP - GRN ${grn.grnNumber}`
            }
          ]
        }
      }
    });

    await tx.gRN.update({
      where: { id: grnId },
      data: { isJournaled: true, journalId: journal.id }
    });

    return journal;
  }

  private static async ensureGenericAccount(tx: any, companyId: string, category: string, name: string) {
    const typeName = category === 'REVENUE' ? 'INCOME' : 'EXPENSE';
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
